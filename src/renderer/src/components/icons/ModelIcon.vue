<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useProviderStore } from '@/stores/providerStore'
import { useAgentStore } from '@/stores/ui/agent'
import { createBrowserClient } from '@api/BrowserClient'
import AcpAgentIcon from './AcpAgentIcon.vue'
import deepchatLogo from '@/assets/logo.png?url'
import {
  DEFAULT_MODEL_ICON_KEY,
  isMonoModelIconUrl,
  modelIcons,
  resolveModelIconKey
} from './modelIconRegistry'

interface Props {
  modelId: string
  agentId?: string
  customClass?: string
  isDark?: boolean
  linkable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  agentId: '',
  customClass: 'w-4 h-4',
  isDark: false,
  linkable: false
})

const providerStore = useProviderStore()
const agentStore = useAgentStore()
const iconLoadFailed = ref(false)
const iconLoaded = ref(false)
const imgRef = ref<HTMLImageElement | null>(null)

const syncCachedIconLoad = async () => {
  await nextTick()
  const img = imgRef.value
  if (img?.complete && img.naturalWidth > 0) {
    iconLoaded.value = true
  }
}

const provider = computed(() => {
  if (!props.modelId) return undefined
  return providerStore.providers.find((item) => item.id === props.modelId)
})

const iconKey = computed(() => {
  return (
    resolveModelIconKey(props.modelId) ??
    resolveModelIconKey(provider.value?.apiType) ??
    DEFAULT_MODEL_ICON_KEY
  )
})

const agentLookupId = computed(() => props.agentId.trim() || props.modelId)

const resolvedAgent = computed(() => {
  if (!agentLookupId.value) {
    return undefined
  }
  return agentStore.agents.find((agent) => agent.id === agentLookupId.value)
})

const dynamicAgentIcon = computed(() => resolvedAgent.value?.icon ?? '')

const builtinAgentLogo = computed(() => {
  const agent = resolvedAgent.value
  if (
    agent &&
    agent.id === 'deepchat' &&
    agent.type === 'deepchat' &&
    !agent.icon?.trim() &&
    !agent.avatar
  ) {
    return deepchatLogo
  }
  return ''
})

const useDynamicAcpRegistryIcon = computed(() => {
  const icon = dynamicAgentIcon.value.trim()
  return icon.startsWith('https://cdn.agentclientprotocol.com/registry/') && icon.endsWith('.svg')
})

const invert = computed(() => {
  if ((dynamicAgentIcon.value || builtinAgentLogo.value) && !iconLoadFailed.value) {
    return false
  }
  if (!props.isDark) {
    return false
  }
  return isMonoModelIconUrl(modelIcons[iconKey.value])
})

const resolvedIconSrc = computed(() => {
  if (dynamicAgentIcon.value && !iconLoadFailed.value) {
    return dynamicAgentIcon.value
  }
  if (builtinAgentLogo.value) {
    return builtinAgentLogo.value
  }
  return modelIcons[iconKey.value]
})

const linkUrl = computed(() => provider.value?.websites?.official)

const isLink = computed(() => props.linkable && !!linkUrl.value)

const handleIconClick = () => {
  const url = linkUrl.value
  if (!url) return
  const client = createBrowserClient()
  void client.openExternal(url).catch(() => {
    window.open(url, '_blank', 'noopener,noreferrer')
  })
}

watch(
  () => [props.modelId, props.agentId, resolvedIconSrc.value] as const,
  () => {
    iconLoadFailed.value = false
    iconLoaded.value = false
    void syncCachedIconLoad()
  },
  { immediate: true }
)

const handleIconError = () => {
  if (dynamicAgentIcon.value) {
    iconLoadFailed.value = true
  }
  iconLoaded.value = true
}

const handleIconLoad = () => {
  iconLoaded.value = true
}
</script>

<template>
  <AcpAgentIcon
    v-if="useDynamicAcpRegistryIcon"
    :agent-id="agentLookupId"
    :icon="dynamicAgentIcon"
    :alt="props.modelId"
    :fallback-text="props.modelId"
    :custom-class="customClass"
  />
  <component
    :is="isLink ? 'a' : 'span'"
    v-else
    class="model-icon-shell relative inline-flex shrink-0 items-center justify-center overflow-hidden"
    :class="[customClass, isLink ? 'cursor-pointer' : '']"
    v-bind="
      isLink ? { href: linkUrl, title: linkUrl, target: '_blank', rel: 'noopener noreferrer' } : {}
    "
    @click.prevent="handleIconClick"
  >
    <span
      v-if="!iconLoaded"
      class="model-icon-skeleton absolute inset-0 rounded-sm bg-muted/70"
      aria-hidden="true"
    />
    <img
      ref="imgRef"
      :src="resolvedIconSrc"
      :alt="iconKey"
      :class="[
        'size-full object-contain',
        { invert },
        invert
          ? iconLoaded
            ? 'opacity-50'
            : 'opacity-0'
          : iconLoaded
            ? 'opacity-100'
            : 'opacity-0'
      ]"
      decoding="async"
      @load="handleIconLoad"
      @error="handleIconError"
    />
  </component>
</template>

<style scoped>
.invert {
  filter: invert(1);
}
</style>
