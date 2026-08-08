import type { DeepchatBridge } from '@shared/contracts/bridge'
import {
  oauthOpenAICodexStatusChangedEvent,
  oauthXaiGrokStatusChangedEvent,
  oauthAigotokenStatusChangedEvent
} from '@shared/contracts/events'
import {
  oauthOpenAICodexCancelLoginRoute,
  oauthOpenAICodexCompleteBrowserLoginFromUrlRoute,
  oauthOpenAICodexGetStatusRoute,
  oauthOpenAICodexLogoutRoute,
  oauthOpenAICodexStartBrowserLoginRoute,
  oauthGithubCopilotStartDeviceFlowLoginRoute,
  oauthGithubCopilotStartLoginRoute,
  oauthXaiGrokCancelLoginRoute,
  oauthXaiGrokGetStatusRoute,
  oauthXaiGrokLogoutRoute,
  oauthXaiGrokStartDeviceLoginRoute,
  oauthAigotokenGetStatusRoute,
  oauthAigotokenStartBrowserLoginRoute,
  oauthAigotokenCompleteBrowserLoginFromUrlRoute,
  oauthAigotokenCancelLoginRoute,
  oauthAigotokenLogoutRoute,
  type OpenAICodexAuthStatus,
  type XaiGrokAuthStatus,
  type AigotokenAuthStatus
} from '@shared/contracts/routes'
import { getDeepchatBridge } from './core'

export function createOAuthClient(bridge: DeepchatBridge = getDeepchatBridge()) {
  async function startGitHubCopilotLogin(providerId: string): Promise<boolean> {
    const result = await bridge.invoke(oauthGithubCopilotStartLoginRoute.name, { providerId })
    return result.success
  }

  async function startGitHubCopilotDeviceFlowLogin(providerId: string): Promise<boolean> {
    const result = await bridge.invoke(oauthGithubCopilotStartDeviceFlowLoginRoute.name, {
      providerId
    })
    return result.success
  }

  async function getOpenAICodexStatus(): Promise<OpenAICodexAuthStatus> {
    const result = await bridge.invoke(oauthOpenAICodexGetStatusRoute.name, {})
    return result.status
  }

  async function startOpenAICodexBrowserLogin(): Promise<OpenAICodexAuthStatus> {
    const result = await bridge.invoke(oauthOpenAICodexStartBrowserLoginRoute.name, {})
    return result.status
  }

  async function completeOpenAICodexBrowserLoginFromUrl(
    callbackUrl: string
  ): Promise<OpenAICodexAuthStatus> {
    const result = await bridge.invoke(oauthOpenAICodexCompleteBrowserLoginFromUrlRoute.name, {
      callbackUrl
    })
    return result.status
  }

  async function cancelOpenAICodexLogin(): Promise<OpenAICodexAuthStatus> {
    const result = await bridge.invoke(oauthOpenAICodexCancelLoginRoute.name, {})
    return result.status
  }

  async function logoutOpenAICodex(): Promise<OpenAICodexAuthStatus> {
    const result = await bridge.invoke(oauthOpenAICodexLogoutRoute.name, {})
    return result.status
  }

  function onOpenAICodexStatusChanged(
    listener: (status: OpenAICodexAuthStatus) => void
  ): () => void {
    return bridge.on(oauthOpenAICodexStatusChangedEvent.name, (payload) => {
      listener(payload.status)
    })
  }

  async function getXaiGrokStatus(): Promise<XaiGrokAuthStatus> {
    const result = await bridge.invoke(oauthXaiGrokGetStatusRoute.name, {})
    return result.status
  }

  async function startXaiGrokDeviceLogin(): Promise<XaiGrokAuthStatus> {
    const result = await bridge.invoke(oauthXaiGrokStartDeviceLoginRoute.name, {})
    return result.status
  }

  async function cancelXaiGrokLogin(): Promise<XaiGrokAuthStatus> {
    const result = await bridge.invoke(oauthXaiGrokCancelLoginRoute.name, {})
    return result.status
  }

  async function logoutXaiGrok(): Promise<XaiGrokAuthStatus> {
    const result = await bridge.invoke(oauthXaiGrokLogoutRoute.name, {})
    return result.status
  }

  function onXaiGrokStatusChanged(listener: (status: XaiGrokAuthStatus) => void): () => void {
    return bridge.on(oauthXaiGrokStatusChangedEvent.name, (payload) => {
      listener(payload.status)
    })
  }

  async function getAigotokenStatus(): Promise<AigotokenAuthStatus> {
    const result = await bridge.invoke(oauthAigotokenGetStatusRoute.name, {})
    return result.status
  }

  async function startAigotokenBrowserLogin(): Promise<AigotokenAuthStatus> {
    const result = await bridge.invoke(oauthAigotokenStartBrowserLoginRoute.name, {})
    return result.status
  }

  async function completeAigotokenBrowserLoginFromUrl(
    callbackUrl: string
  ): Promise<AigotokenAuthStatus> {
    const result = await bridge.invoke(oauthAigotokenCompleteBrowserLoginFromUrlRoute.name, {
      callbackUrl
    })
    return result.status
  }

  async function cancelAigotokenLogin(): Promise<AigotokenAuthStatus> {
    const result = await bridge.invoke(oauthAigotokenCancelLoginRoute.name, {})
    return result.status
  }

  async function logoutAigotoken(): Promise<AigotokenAuthStatus> {
    const result = await bridge.invoke(oauthAigotokenLogoutRoute.name, {})
    return result.status
  }

  function onAigotokenStatusChanged(listener: (status: AigotokenAuthStatus) => void): () => void {
    return bridge.on(oauthAigotokenStatusChangedEvent.name, (payload) => {
      listener(payload.status)
    })
  }

  return {
    startGitHubCopilotLogin,
    startGitHubCopilotDeviceFlowLogin,
    getOpenAICodexStatus,
    startOpenAICodexBrowserLogin,
    completeOpenAICodexBrowserLoginFromUrl,
    cancelOpenAICodexLogin,
    logoutOpenAICodex,
    onOpenAICodexStatusChanged,
    getXaiGrokStatus,
    startXaiGrokDeviceLogin,
    cancelXaiGrokLogin,
    logoutXaiGrok,
    onXaiGrokStatusChanged,
    getAigotokenStatus,
    startAigotokenBrowserLogin,
    completeAigotokenBrowserLoginFromUrl,
    cancelAigotokenLogin,
    logoutAigotoken,
    onAigotokenStatusChanged
  }
}

export type OAuthClient = ReturnType<typeof createOAuthClient>
