<template>
  <div
    class="text-xs leading-4 text-[rgba(37,37,37,0.5)] dark:text-white/50 flex flex-col gap-[6px]"
  >
    <div
      class="flex items-center gap-[10px] select-none w-full min-w-0 overflow-hidden"
      @click="$emit('toggle')"
    >
      <span class="whitespace-nowrap shrink-0">
        {{ label }}
      </span>
      <Icon
        v-if="thinking && !expanded"
        icon="lucide:ellipsis"
        class="w-[14px] h-[14px] text-[rgba(37,37,37,0.5)] dark:text-white/50 shrink-0 animate-[pulse_1s_ease-in-out_infinite]"
      />
      <Icon
        v-else-if="expanded"
        icon="lucide:chevron-down"
        class="w-[14px] h-[14px] text-[rgba(37,37,37,0.5)] dark:text-white/50 shrink-0"
      />
      <Icon
        v-else
        icon="lucide:chevron-right"
        class="w-[14px] h-[14px] text-[rgba(37,37,37,0.5)] dark:text-white/50 shrink-0"
      />

      <div
        v-if="!expanded && previewText && !previewDone"
        ref="thinkPreviewShell"
        class="think-preview-shell"
        role="presentation"
      >
        <div ref="thinkPreviewTrack" class="think-preview-track">{{ previewText }}</div>
      </div>
    </div>

    <div v-if="expanded" class="w-full relative">
      <NodeRenderer
        v-if="sanitizedContent"
        class="think-prose w-full max-w-full"
        :isDark="themeStore.isDark"
        :content="sanitizedContent"
        :deferNodesUntilVisible="true"
        :maxLiveNodes="120"
        :liveNodeBuffer="30"
        :customId="customId"
      />
    </div>

    <Icon
      v-if="thinking && expanded"
      icon="lucide:ellipsis"
      class="w-[14px] h-[14px] text-[rgba(37,37,37,0.5)] dark:text-white/50 animate-[pulse_1s_ease-in-out_infinite]"
    />
  </div>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { Icon } from '@iconify/vue'
import { h, computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import NodeRenderer, { setCustomComponents, CodeBlockNode, PreCodeNode } from 'markstream-vue'
import { ensureMarkdownWorkers } from '@/lib/markdownWorkerLifecycle'

const props = defineProps<{
  label: string
  expanded: boolean
  thinking: boolean
  content?: string
}>()

// Strip <style> tags to prevent global style pollution
const sanitizedContent = computed(() => {
  if (!props.content) return ''
  return props.content.replace(/<style[\s\S]*?<\/style>/gi, '')
})

const PREVIEW_MAX_CHARS = 240
const PREVIEW_PX_PER_SECOND = 200
const reducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const previewText = computed(() => {
  const raw = props.content ?? ''
  if (!raw) return ''
  const cleaned = raw
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[#>*\-\s]+/gm, ' ')
    .replace(/`{1,3}/g, ' ')
    .replace(/[*_~]{1,2}([^*_~]+)[*_~]{1,2}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned.length > PREVIEW_MAX_CHARS
    ? `${cleaned.slice(0, PREVIEW_MAX_CHARS).trimEnd()}…`
    : cleaned
})

const thinkPreviewShell = ref<HTMLElement | null>(null)
const thinkPreviewTrack = ref<HTMLElement | null>(null)
const previewDone = ref(false)
let textWidth = 0
let rafId: number | null = null
let playing = false
let prevTs = 0
let offset = 0

const stopPlay = () => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  playing = false
}

const measurePreview = () => {
  const shell = thinkPreviewShell.value
  const track = thinkPreviewTrack.value
  if (!shell || !track) return false
  textWidth = track.scrollWidth
  return true
}

const startPlay = async () => {
  if (playing || props.expanded || previewDone.value || !previewText.value) return
  await nextTick()
  if (props.expanded || previewDone.value || !previewText.value) return
  if (!measurePreview()) return
  const shell = thinkPreviewShell.value
  if (!shell) return
  offset = shell.clientWidth
  if (reducedMotion) return
  playing = true
  prevTs = performance.now()
  const tick = (ts: number) => {
    if (!playing) return
    const dt = ts - prevTs
    prevTs = ts
    offset -= (PREVIEW_PX_PER_SECOND * dt) / 1000
    const track = thinkPreviewTrack.value
    if (!track) {
      stopPlay()
      return
    }
    if (offset <= -textWidth) {
      previewDone.value = true
      stopPlay()
      return
    }
    track.style.transform = `translate3d(${offset}px, 0, 0)`
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

defineEmits<{
  (e: 'toggle'): void
}>()
const customId = 'thinking-content'
const themeStore = useThemeStore()
const propsWatchSource = () => [props.label, props.expanded, props.thinking, props.content] as const

onMounted(() => {
  ensureMarkdownWorkers().catch((error) => {
    console.error('Failed to initialize markdown workers:', error)
  })
  void startPlay()
})

onBeforeUnmount(() => {
  stopPlay()
})

watch(propsWatchSource, () => {}, { immediate: true })

watch(
  () => props.expanded,
  (expanded) => {
    if (expanded) {
      stopPlay()
    } else {
      void startPlay()
    }
  }
)

watch(
  () => previewText.value,
  () => {
    requestAnimationFrame(() => {
      if (playing) {
        measurePreview()
        return
      }
      if (!props.expanded && !previewDone.value && previewText.value) {
        void startPlay()
      }
    })
  }
)

setCustomComponents(customId, {
  code_block: (_props) => {
    const isMermaid = _props.node.language === 'mermaid'
    if (isMermaid) {
      // 对于 Mermaid 代码块，直接返回 MermaidNode 组件
      return h(PreCodeNode.vue, {
        ..._props
      })
    }
    return h(
      CodeBlockNode,
      {
        ..._props,
        isShowPreview: false,
        showCopyButton: false,
        showExpandButton: false,
        showPreviewButton: false,
        showFontSizeButtons: false
      },
      undefined
    )
  },
  mermaid: (_props) =>
    h(PreCodeNode.vue, {
      ..._props
    })
})
</script>

<style scoped>
@reference '../../assets/style.css';

.think-prose {
  --ms-text-body: calc(0.75rem * var(--dc-font-scale));
  --ms-leading-body: calc(1rem * var(--dc-font-scale));
  --ms-text-h1: var(--ms-text-body);
  --ms-text-h2: var(--ms-text-body);
  --ms-text-h3: var(--ms-text-body);
  --ms-text-h4: var(--ms-text-body);
  --ms-text-h5: var(--ms-text-body);
  --ms-text-h6: var(--ms-text-body);
  --ms-leading-h1: var(--ms-leading-body);
  --ms-leading-h2: var(--ms-leading-body);
  --ms-leading-h3: var(--ms-leading-body);
  --ms-leading-h4: var(--ms-leading-body);
  --ms-leading-h5: var(--ms-leading-body);
  --ms-leading-h6: var(--ms-leading-body);
  --ms-font-sans: var(--dc-font-family);
}

.think-prose :deep(:where(h1, h2, h3, h4, h5, h6, .heading-node)) {
  font-size: inherit;
  line-height: inherit;
}

.think-prose :where(p, ul, li) {
  @apply mb-1 mt-0;
}
.think-prose :where(ul) {
  @apply my-1.5;
}
.think-prose :where(li) {
  @apply my-1.5;
}
.think-prose :where(p, li, ol, ul) {
  letter-spacing: 0;
}
.think-prose :where(ol, ul) {
  padding-left: 1.5em;
}
.think-prose :where(p, li, ol, ul) :where(a) {
  color: inherit;
  text-decoration: underline;
}

.think-preview-shell {
  flex: 1 1 0%;
  min-width: 0;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 12px,
    #000 calc(100% - 12px),
    transparent 100%
  );
  mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 12px,
    #000 calc(100% - 12px),
    transparent 100%
  );
}

.think-preview-track {
  display: block;
  width: max-content;
  white-space: nowrap;
  will-change: transform;
  backface-visibility: hidden;
}
</style>
