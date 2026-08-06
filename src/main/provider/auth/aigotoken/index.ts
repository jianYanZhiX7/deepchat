import { shell } from 'electron'
import { URL } from 'url'
import type { DeepchatEventPublisher } from '@shared/contracts/events'
import type { AigotokenAuthStatus } from '@shared/types/aigotoken'
import type { LLM_PROVIDER, MODEL_META } from '@shared/types/provider'
import {
  startOAuthLoopbackCallbackSession,
  type OAuthLoopbackCallbackSession
} from '../oauthLoopbackCallback'
import {
  AIGOTOKEN_AUTHORIZE_URL,
  AIGOTOKEN_BROWSER_TIMEOUT_MS,
  AIGOTOKEN_CLIENT_ID,
  AIGOTOKEN_MODELS_URL,
  AIGOTOKEN_REDIRECT_PATH,
  AIGOTOKEN_REDIRECT_PORT,
  AIGOTOKEN_REDIRECT_URI,
  AIGOTOKEN_REQUEST_TIMEOUT_MS,
  AIGOTOKEN_TOKEN_URL
} from './constants'
import { createAigotokenPkcePair, createAigotokenState } from './pkce'

export type AigotokenProviderSettingsPort = {
  getProviderById(id: string): LLM_PROVIDER | undefined
  setProviderById(id: string, provider: LLM_PROVIDER): void
}

type PendingBrowserFlow = {
  state: string
  codeVerifier: string
  redirectUri: string
  callbackSession: OAuthLoopbackCallbackSession
  cancelled: boolean
  flowPromise?: Promise<void>
}

type TokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

let globalAigotokenAuth: AigotokenAuth | null = null

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/access_token["\s:=]+[^"'\s,}]+/gi, 'access_token:[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/g, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9]+/g, 'sk-[redacted]')
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text()
    if (!text.trim()) {
      return `${response.status} ${response.statusText}`
    }
    return text.slice(0, 1000)
  } catch {
    return `${response.status} ${response.statusText}`
  }
}

export class AigotokenAuth {
  private pendingBrowserFlow: PendingBrowserFlow | null = null
  private lastError: string | null = null

  constructor(
    private readonly providerSettings: AigotokenProviderSettingsPort,
    private readonly publishEvent: DeepchatEventPublisher
  ) {}

  getStatus(): AigotokenAuthStatus {
    if (this.pendingBrowserFlow && !this.pendingBrowserFlow.cancelled) {
      return {
        state: 'pending-browser',
        authenticated: false,
        ...(this.lastError ? { error: this.lastError } : {})
      }
    }

    const provider = this.providerSettings.getProviderById('aigotoken')
    if (provider?.apiKey) {
      return {
        state: 'authenticated',
        authenticated: true
      }
    }

    return {
      state: this.lastError ? 'error' : 'signed-out',
      authenticated: false,
      ...(this.lastError ? { error: this.lastError } : {})
    }
  }

  async startBrowserLogin(): Promise<AigotokenAuthStatus> {
    this.cancelLogin()
    this.lastError = null

    const state = createAigotokenState()
    const pkce = createAigotokenPkcePair()
    let callbackSession: OAuthLoopbackCallbackSession | null = null

    try {
      const configuredRedirect = new URL(AIGOTOKEN_REDIRECT_URI)
      callbackSession = await startOAuthLoopbackCallbackSession({
        expectedState: state,
        path: configuredRedirect.pathname || AIGOTOKEN_REDIRECT_PATH,
        preferredPort: Number(configuredRedirect.port) || AIGOTOKEN_REDIRECT_PORT,
        redirectHost: configuredRedirect.hostname || 'localhost',
        timeoutMs: AIGOTOKEN_BROWSER_TIMEOUT_MS,
        invalidCallbackMessage: 'Invalid aigotoken OAuth callback'
      })

      const authUrl = new URL(AIGOTOKEN_AUTHORIZE_URL)
      authUrl.searchParams.set('client_id', AIGOTOKEN_CLIENT_ID)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('redirect_uri', callbackSession.redirectUri)
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('code_challenge', pkce.codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')

      const flow: PendingBrowserFlow = {
        state,
        codeVerifier: pkce.codeVerifier,
        redirectUri: callbackSession.redirectUri,
        callbackSession,
        cancelled: false
      }
      this.pendingBrowserFlow = flow
      flow.flowPromise = this.completeBrowserLogin(flow, callbackSession.waitForCallback())
      await shell.openExternal(authUrl.toString())
      this.publishStatusChanged()
      return this.getStatus()
    } catch (error) {
      this.lastError = sanitizeError(error)
      this.pendingBrowserFlow = null
      callbackSession?.close()
      this.publishStatusChanged()
      return this.getStatus()
    }
  }

  async completeBrowserLoginFromCallbackUrl(callbackUrl: string): Promise<AigotokenAuthStatus> {
    const flow = this.pendingBrowserFlow
    if (!flow || flow.cancelled) {
      this.lastError = 'Aigotoken browser login is not pending'
      this.publishStatusChanged()
      return this.getStatus()
    }

    const resolution = flow.callbackSession.resolveCallbackUrl(callbackUrl)
    if (resolution.kind === 'not-found') {
      this.lastError = 'Aigotoken callback URL is invalid'
      this.publishStatusChanged()
      return this.getStatus()
    }
    if (resolution.kind === 'failure') {
      try {
        await flow.flowPromise
      } catch {
        // error already handled in completeBrowserLogin
      }
      return this.getStatus()
    }

    await flow.flowPromise
    return this.getStatus()
  }

  cancelLogin(): AigotokenAuthStatus {
    if (this.pendingBrowserFlow) {
      this.pendingBrowserFlow.cancelled = true
      this.pendingBrowserFlow.callbackSession.close()
      this.pendingBrowserFlow = null
    }
    this.publishStatusChanged()
    return this.getStatus()
  }

  async logout(): Promise<AigotokenAuthStatus> {
    this.cancelLogin()
    this.lastError = null

    const provider = this.providerSettings.getProviderById('aigotoken')
    if (provider) {
      this.providerSettings.setProviderById('aigotoken', {
        ...provider,
        apiKey: ''
      })
    }

    this.publishStatusChanged()
    return this.getStatus()
  }

  private async completeBrowserLogin(
    flow: PendingBrowserFlow,
    callbackPromise: Promise<{ code: string }>
  ): Promise<void> {
    try {
      const { code } = await callbackPromise
      if (flow.cancelled || this.pendingBrowserFlow !== flow) {
        return
      }

      const apiKey = await this.exchangeAuthorizationCode(code, flow.codeVerifier, flow.redirectUri)
      if (flow.cancelled || this.pendingBrowserFlow !== flow) {
        return
      }

      const provider = this.providerSettings.getProviderById('aigotoken')
      if (provider) {
        this.providerSettings.setProviderById('aigotoken', {
          ...provider,
          apiKey
        })
      }

      await this.fetchAndStoreModels(apiKey)

      this.lastError = null
      this.pendingBrowserFlow = null
      flow.callbackSession.close()
      this.publishStatusChanged()
    } catch (error) {
      if (flow.cancelled || this.pendingBrowserFlow !== flow) {
        return
      }

      this.lastError = sanitizeError(error)
      this.pendingBrowserFlow = null
      flow.callbackSession.close()
      this.publishStatusChanged()
    }
  }

  private async exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<string> {
    const body = new URLSearchParams()
    body.set('grant_type', 'authorization_code')
    body.set('client_id', AIGOTOKEN_CLIENT_ID)
    body.set('code', code)
    body.set('redirect_uri', redirectUri)
    body.set('code_verifier', codeVerifier)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), AIGOTOKEN_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(AIGOTOKEN_TOKEN_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body,
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(await readErrorBody(response))
      }

      const payload = (await response.json()) as TokenResponse

      if (payload.error) {
        throw new Error(payload.error_description || payload.error)
      }

      if (!payload.access_token || typeof payload.access_token !== 'string') {
        throw new Error('Token response did not include an access token')
      }

      return payload.access_token.trim()
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`Aigotoken auth request timed out after ${AIGOTOKEN_REQUEST_TIMEOUT_MS}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private async fetchAndStoreModels(apiKey: string): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), AIGOTOKEN_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(AIGOTOKEN_MODELS_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        signal: controller.signal
      })

      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as {
        data?: { id: string; owned_by?: string }[]
      }

      const models: MODEL_META[] = (payload.data || []).map((model) => ({
        id: model.id,
        name: model.id,
        group: model.owned_by || 'aigotoken',
        providerId: 'aigotoken',
        enabled: true
      }))

      if (models.length > 0) {
        const provider = this.providerSettings.getProviderById('aigotoken')
        if (provider) {
          this.providerSettings.setProviderById('aigotoken', {
            ...provider,
            models
          })
        }
      }
    } catch (error) {
      console.warn('aigotoken: model fetch failed after auth:', sanitizeError(error))
    } finally {
      clearTimeout(timeout)
    }
  }

  private publishStatusChanged(): void {
    this.publishEvent('oauth.aigotoken.statusChanged', {
      status: this.getStatus(),
      version: Date.now()
    })
  }
}

export function initializeGlobalAigotokenAuth(
  providerSettings: AigotokenProviderSettingsPort,
  publishEvent: DeepchatEventPublisher
): AigotokenAuth {
  if (!globalAigotokenAuth) {
    globalAigotokenAuth = new AigotokenAuth(providerSettings, publishEvent)
  }
  return globalAigotokenAuth
}

export function getGlobalAigotokenAuth(): AigotokenAuth {
  if (!globalAigotokenAuth) {
    throw new Error('Aigotoken auth is not initialized')
  }
  return globalAigotokenAuth
}
