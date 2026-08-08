<template>
  <div class="flex h-full w-full items-center justify-center bg-background p-6">
    <div
      class="w-full max-w-md rounded-xl border border-black/10 bg-background p-8 shadow-sm dark:border-white/10"
    >
      <div class="mb-6 flex flex-col items-center gap-3 text-center">
        <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon icon="lucide:key-round" class="size-6" />
        </div>
        <h1 class="text-xl font-semibold leading-tight">
          {{ t('settings.provider.aigotokenLoginRequiredTitle') }}
        </h1>
        <p class="text-sm leading-5 text-muted-foreground">
          {{ t('settings.provider.aigotokenLoginRequiredDesc') }}
        </p>
      </div>

      <div :class="['mb-4 rounded-md border px-3 py-2', statusClass]">
        <div class="flex items-start gap-2">
          <Spinner v-if="isPending" class="mt-0.5 size-4 shrink-0" />
          <Icon v-else :icon="statusIcon" class="mt-0.5 size-4 shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium leading-5">
              {{ statusText }}
            </div>
            <div v-if="status.error" class="mt-1 text-xs opacity-90">
              {{ status.error }}
            </div>
          </div>
        </div>
      </div>

      <Button class="w-full" :disabled="isBusy" @click="startBrowserLogin">
        <Spinner v-if="isBrowserBusy" class="size-4" data-icon="inline-start" />
        <Icon v-else icon="lucide:globe" class="size-4" data-icon="inline-start" />
        {{ browserButtonText }}
      </Button>

      <div class="mt-3 flex flex-wrap justify-center gap-2">
        <Button v-if="isPending" variant="outline" size="sm" @click="isCallbackDialogOpen = true">
          <Icon icon="lucide:clipboard-paste" class="size-4" />
          {{ t('settings.provider.aigotokenPasteCallback') }}
        </Button>
        <Button v-if="isPending" variant="outline" size="sm" @click="cancelLogin">
          <Icon icon="lucide:x" class="size-4" />
          {{ t('settings.provider.aigotokenCancel') }}
        </Button>
      </div>

      <div class="mt-6 text-center text-xs leading-5 text-muted-foreground">
        {{ t('settings.provider.aigotokenLoginTip') }}
      </div>
    </div>

    <Dialog v-model:open="isCallbackDialogOpen">
      <DialogContent class="w-[90vw] max-w-[460px]">
        <DialogHeader>
          <DialogTitle class="text-base">
            {{ t('settings.provider.aigotokenCallbackTitle') }}
          </DialogTitle>
          <DialogDescription class="text-sm">
            {{ t('settings.provider.aigotokenCallbackDescription') }}
          </DialogDescription>
        </DialogHeader>
        <div class="mt-2 flex flex-col gap-3">
          <Input
            v-model="callbackUrl"
            :placeholder="t('settings.provider.aigotokenCallbackPlaceholder')"
            @keydown.enter.prevent="completeBrowserLoginFromUrl"
          />
          <div class="flex justify-end gap-2">
            <Button variant="outline" size="sm" @click="isCallbackDialogOpen = false">
              {{ t('common.cancel') }}
            </Button>
            <Button
              size="sm"
              :disabled="!callbackUrl.trim() || busyAction === 'callback'"
              @click="completeBrowserLoginFromUrl"
            >
              <Spinner v-if="busyAction === 'callback'" class="size-4" data-icon="inline-start" />
              {{ t('settings.provider.aigotokenCompleteAuthentication') }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@shadcn/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@shadcn/components/ui/dialog'
import { Input } from '@shadcn/components/ui/input'
import { Spinner } from '@shadcn/components/ui/spinner'
import { Icon } from '@iconify/vue'
import { createOAuthClient } from '@api/OAuthClient'
import { createProviderClient } from '@api/ProviderClient'
import type { AigotokenAuthStatus } from '@shared/contracts/routes'

const { t } = useI18n()

const signedOutStatus: AigotokenAuthStatus = {
  state: 'signed-out',
  authenticated: false
}

const oauthClient = createOAuthClient()
const providerClient = createProviderClient()
const status = ref<AigotokenAuthStatus>(signedOutStatus)
const busyAction = ref<'browser' | 'callback' | 'cancel' | null>(null)
const isCallbackDialogOpen = ref(false)
const callbackUrl = ref('')
let unsubscribeStatus: (() => void) | null = null

const isPending = computed(() => status.value.state === 'pending-browser')
const isBusy = computed(() => busyAction.value !== null)
const isBrowserBusy = computed(
  () => busyAction.value === 'browser' || status.value.state === 'pending-browser'
)
const statusClass = computed(() => {
  if (status.value.authenticated) {
    return 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
  }
  if (status.value.state === 'error') {
    return 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
  }
  if (isPending.value) {
    return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
  }
  return 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'
})
const statusIcon = computed(() => {
  if (status.value.authenticated) return 'lucide:check-circle'
  if (status.value.state === 'error') return 'lucide:circle-alert'
  return 'lucide:info'
})
const statusText = computed(() => {
  switch (status.value.state) {
    case 'authenticated':
      return t('settings.provider.aigotokenConnected')
    case 'pending-browser':
      return t('settings.provider.aigotokenPendingBrowser')
    case 'error':
      return t('settings.provider.aigotokenError')
    case 'signed-out':
    default:
      return t('settings.provider.aigotokenNotConnected')
  }
})
const browserButtonText = computed(() =>
  isBrowserBusy.value
    ? t('settings.provider.loggingIn')
    : t('settings.provider.aigotokenSignInBrowser')
)

const applyStatus = (nextStatus: AigotokenAuthStatus) => {
  status.value = nextStatus
}

const refreshStatus = async () => {
  applyStatus(await oauthClient.getAigotokenStatus())
}

const runAuthAction = async (
  action: 'browser' | 'callback' | 'cancel',
  runner: () => Promise<AigotokenAuthStatus>
) => {
  busyAction.value = action
  try {
    applyStatus(await runner())
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    status.value = {
      state: 'error',
      authenticated: false,
      error: message
    }
  } finally {
    busyAction.value = null
  }
}

const startBrowserLogin = () =>
  runAuthAction('browser', () => oauthClient.startAigotokenBrowserLogin())

const completeBrowserLoginFromUrl = () => {
  if (busyAction.value === 'callback') return
  const url = callbackUrl.value.trim()
  if (!url) return
  runAuthAction('callback', async () => {
    const nextStatus = await oauthClient.completeAigotokenBrowserLoginFromUrl(url)
    if (nextStatus.authenticated) {
      isCallbackDialogOpen.value = false
      callbackUrl.value = ''
    }
    return nextStatus
  })
}

const cancelLogin = () => runAuthAction('cancel', () => oauthClient.cancelAigotokenLogin())

const enableProviderOnAuth = async () => {
  try {
    await providerClient.updateProviderAtomic('aigotoken', { enable: true })
  } catch (error) {
    console.warn('[AigotokenLogin] failed to enable aigotoken provider:', error)
  }
}

watch(
  () => status.value.authenticated,
  (authed) => {
    if (authed) {
      console.info('[AigotokenLogin] authenticated, enabling provider')
      void enableProviderOnAuth()
    }
  }
)

onMounted(() => {
  unsubscribeStatus = oauthClient.onAigotokenStatusChanged(applyStatus)
  void refreshStatus()
})

onUnmounted(() => {
  unsubscribeStatus?.()
  unsubscribeStatus = null
})
</script>
