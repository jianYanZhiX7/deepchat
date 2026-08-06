<template>
  <div class="flex flex-col items-start gap-3">
    <Label class="flex-1">
      {{ t('settings.provider.aigotokenAuth') }}
    </Label>

    <div :class="['w-full rounded-md border px-3 py-2', statusClass]">
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

    <div class="flex flex-wrap gap-2">
      <Button
        v-if="status.authenticated"
        variant="outline"
        size="sm"
        class="text-xs text-normal rounded-lg"
        :disabled="!provider.enable"
        @click="openModelCheckDialog"
      >
        <Icon icon="lucide:check-check" class="h-4 w-4 text-muted-foreground" />
        {{ t('settings.provider.verifyKey') }}
      </Button>

      <Button
        variant="default"
        size="sm"
        class="text-xs"
        :disabled="isBusy"
        @click="startBrowserLogin"
      >
        <Spinner v-if="isBrowserBusy" class="size-4" data-icon="inline-start" />
        <Icon v-else icon="lucide:globe" class="size-4" data-icon="inline-start" />
        {{ browserButtonText }}
      </Button>

      <Button
        v-if="isPending"
        variant="outline"
        size="sm"
        class="text-xs"
        @click="isCallbackDialogOpen = true"
      >
        <Icon icon="lucide:clipboard-paste" class="h-4 w-4" />
        {{ t('settings.provider.aigotokenPasteCallback') }}
      </Button>

      <Button
        v-if="isPending"
        variant="outline"
        size="sm"
        class="text-xs"
        @click="cancelLogin"
      >
        <Icon icon="lucide:x" class="h-4 w-4" />
        {{ t('settings.provider.aigotokenCancel') }}
      </Button>

      <Button
        v-if="status.authenticated"
        variant="outline"
        size="sm"
        class="text-xs text-destructive"
        @click="logout"
      >
        <Icon icon="lucide:unlink" class="h-4 w-4 text-destructive" />
        {{ t('settings.provider.aigotokenSignOut') }}
      </Button>
    </div>

    <div class="text-xs leading-5 text-muted-foreground">
      {{ t('settings.provider.aigotokenLoginTip') }}
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
import { Label } from '@shadcn/components/ui/label'
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
import { useModelCheckStore } from '@/stores/modelCheck'
import type { LLM_PROVIDER } from '@shared/types/provider'
import type { AigotokenAuthStatus } from '@shared/contracts/routes'

const { t } = useI18n()

const props = defineProps<{
  provider: LLM_PROVIDER
}>()

const emit = defineEmits<{
  'auth-success': []
  'auth-error': [error: string]
}>()

const signedOutStatus: AigotokenAuthStatus = {
  state: 'signed-out',
  authenticated: false
}

const oauthClient = createOAuthClient()
const modelCheckStore = useModelCheckStore()
const status = ref<AigotokenAuthStatus>(signedOutStatus)
const busyAction = ref<'browser' | 'callback' | 'cancel' | 'logout' | null>(null)
const isCallbackDialogOpen = ref(false)
const callbackUrl = ref('')
let pollTimer: number | null = null
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
    : status.value.authenticated
      ? t('settings.provider.aigotokenReconnect')
      : t('settings.provider.aigotokenSignInBrowser')
)

const applyStatus = (
  nextStatus: AigotokenAuthStatus,
  options: { notify?: boolean } = {}
) => {
  status.value = nextStatus
  if (!options.notify) return

  if (nextStatus.authenticated) {
    emit('auth-success')
  } else if (nextStatus.state === 'error' && nextStatus.error) {
    emit('auth-error', nextStatus.error)
  }
}

const refreshStatus = async () => {
  applyStatus(await oauthClient.getAigotokenStatus())
}

const runAuthAction = async (
  action: 'browser' | 'callback' | 'cancel' | 'logout',
  runner: () => Promise<AigotokenAuthStatus>
) => {
  busyAction.value = action
  try {
    applyStatus(await runner(), { notify: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : t('settings.provider.loginFailed')
    emit('auth-error', message)
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

const logout = () => runAuthAction('logout', () => oauthClient.logoutAigotoken())

const openModelCheckDialog = () => {
  if (props.provider.enable) {
    modelCheckStore.openDialog(props.provider.id)
  }
}

const stopPolling = () => {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const updatePolling = () => {
  stopPolling()
  if (isPending.value) {
    pollTimer = window.setInterval(() => {
      void refreshStatus()
    }, 2000)
  }
}

onMounted(() => {
  unsubscribeStatus = oauthClient.onAigotokenStatusChanged(applyStatus)
  void refreshStatus()
})

onUnmounted(() => {
  stopPolling()
  unsubscribeStatus?.()
  unsubscribeStatus = null
})

watch(() => status.value.state, updatePolling)
</script>