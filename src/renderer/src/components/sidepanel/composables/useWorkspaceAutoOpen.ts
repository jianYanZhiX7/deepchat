import { onBeforeUnmount, watch, type Ref } from 'vue'
import { createWorkspaceClient } from '@api/WorkspaceClient'
import { flashFiles } from '@/lib/workspaceFileFlash'
import { useSidepanelStore } from '@/stores/ui/sidepanel'
import { useUiSettingsStore } from '@/stores/uiSettingsStore'

interface UseWorkspaceAutoOpenOptions {
  sessionId: Ref<string | null>
  workspacePath: Ref<string | null>
}

const normalizeWorkspaceKey = (value: string | null): string | null => {
  if (!value) {
    return null
  }
  return value
    .trim()
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
}

/**
 * Keeps the workspace watcher alive for the active session even while the side
 * panel is closed, so newly created files can reveal the workspace on their own.
 */
export function useWorkspaceAutoOpen(options: UseWorkspaceAutoOpenOptions) {
  const sidepanelStore = useSidepanelStore()
  const uiSettingsStore = useUiSettingsStore()
  const workspaceClient = createWorkspaceClient()

  let watchedPath: string | null = null
  let syncToken = 0

  const handleInvalidated = (payload: {
    workspacePath: string
    kind: 'fs' | 'git' | 'full'
    source: 'watcher' | 'fallback' | 'lifecycle'
    version: number
    createdPaths: string[]
    modifiedPaths: string[]
  }) => {
    const changedPaths = [...payload.createdPaths, ...payload.modifiedPaths]
    if (changedPaths.length === 0) {
      return
    }

    if (!uiSettingsStore.autoOpenWorkspaceOnNewFile) {
      return
    }

    const sessionId = options.sessionId.value
    if (!sessionId) {
      return
    }

    if (
      normalizeWorkspaceKey(payload.workspacePath) !==
      normalizeWorkspaceKey(options.workspacePath.value)
    ) {
      return
    }

    flashFiles(changedPaths)

    if (!sidepanelStore.open) {
      sidepanelStore.openWorkspaceAuto(sessionId)
      sidepanelStore.ensureSessionState(sessionId).sections.files = true
    }
  }

  const syncWatcher = async (nextPath: string | null) => {
    const previousPath = watchedPath
    if (previousPath === nextPath) {
      return
    }

    const token = ++syncToken
    watchedPath = nextPath

    if (previousPath) {
      try {
        await workspaceClient.unwatchWorkspace(previousPath)
      } catch (error) {
        console.warn('[Workspace] Failed to stop workspace watcher', error)
      }
    }

    if (!nextPath || token !== syncToken) {
      return
    }

    try {
      await workspaceClient.registerWorkspace(nextPath)
      if (token !== syncToken) {
        return
      }
      await workspaceClient.watchWorkspace(nextPath)
    } catch (error) {
      console.warn('[Workspace] Failed to start workspace watcher', error)
    }
  }

  const stopInvalidatedListener = workspaceClient.onInvalidated(handleInvalidated)

  watch(
    [options.sessionId, options.workspacePath, () => uiSettingsStore.autoOpenWorkspaceOnNewFile],
    ([sessionId, workspacePath, enabled]) => {
      void syncWatcher(enabled && sessionId ? workspacePath?.trim() || null : null)
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    syncToken += 1
    stopInvalidatedListener()
    const pendingPath = watchedPath
    watchedPath = null
    if (pendingPath) {
      void workspaceClient.unwatchWorkspace(pendingPath).catch((error) => {
        console.warn('[Workspace] Failed to stop workspace watcher', error)
      })
    }
  })
}
