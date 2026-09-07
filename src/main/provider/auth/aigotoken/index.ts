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
import { setDefaultModelFallback } from '@/session/defaultModelFallback'

export type AigotokenProviderSettingsPort = {
  getProviderById(id: string): LLM_PROVIDER | undefined
  setProviderById(id: string, provider: LLM_PROVIDER): void
  getProviderModels(providerId: string): MODEL_META[]
  setProviderModels(providerId: string, models: MODEL_META[]): void
  batchSetModelStatus(providerId: string, modelStatusMap: Record<string, boolean>): void
  ensureModelStatus(providerId: string, modelId: string, enabled: boolean): void
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

type AigotokenModelRecord = {
  id: string
  owned_by?: string
  is_deepchat?: unknown
  deepchat_default?: unknown
  context_window?: unknown
  context_length?: unknown
  contextLength?: unknown
  input_token_limit?: unknown
  max_input_tokens?: unknown
  max_tokens?: unknown
  max_output_tokens?: unknown
  output_token_limit?: unknown
}

function isDeepchatUsable(record: AigotokenModelRecord): boolean {
  return record.is_deepchat === true || record.is_deepchat === 'true'
}

function isGatewayDefault(record: AigotokenModelRecord): boolean {
  return record.deepchat_default === true || record.deepchat_default === 'true'
}

function resolveDeepchatUsable(fetched: AigotokenModelRecord[]): AigotokenModelRecord[] {
  const flagged = fetched.some((record) => record.is_deepchat !== undefined)
  if (!flagged) {
    return fetched
  }
  return fetched.filter(isDeepchatUsable)
}

function filterDeepchatUsable(fetched: AigotokenModelRecord[]): AigotokenModelRecord[] {
  return resolveDeepchatUsable(fetched)
}

function resolveGatewayDefaultModelId(fetched: AigotokenModelRecord[]): string | null {
  const usable = resolveDeepchatUsable(fetched)
  const defaultRecord = usable.find(isGatewayDefault) ?? usable[0]
  return defaultRecord?.id ?? null
}

function toPositiveTokens(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
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
          apiKey,
          enable: true
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
    const body = JSON.stringify({
      grant_type: 'authorization_code',
      client_id: AIGOTOKEN_CLIENT_ID,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), AIGOTOKEN_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(AIGOTOKEN_TOKEN_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
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

  private mapFetchedModels(fetched: AigotokenModelRecord[]): MODEL_META[] {
    return fetched.map((model) => {
      const contextLength =
        toPositiveTokens(model.context_window) ??
        toPositiveTokens(model.context_length) ??
        toPositiveTokens(model.contextLength) ??
        toPositiveTokens(model.input_token_limit) ??
        toPositiveTokens(model.max_input_tokens)
      const maxTokens =
        toPositiveTokens(model.max_tokens) ??
        toPositiveTokens(model.max_output_tokens) ??
        toPositiveTokens(model.output_token_limit)
      return {
        id: model.id,
        name: model.id,
        group: 'aigotoken',
        providerId: 'aigotoken',
        enabled: true,
        ...(contextLength !== undefined ? { contextLength } : {}),
        ...(maxTokens !== undefined ? { maxTokens } : {})
      }
    })
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

      const payload = (await response.json()) as { data?: AigotokenModelRecord[] }

      const usableFetched = filterDeepchatUsable(payload.data || [])
      if (usableFetched.length === 0) {
        return
      }

      const models = this.mapFetchedModels(usableFetched)

      this.storeFetchedModels(models, usableFetched)
    } catch (error) {
      console.warn('aigotoken: model fetch failed after auth:', sanitizeError(error))
    } finally {
      clearTimeout(timeout)
    }
  }

  private storeFetchedModels(models: MODEL_META[], fetched: AigotokenModelRecord[]): void {
    if (models.length === 0) {
      return
    }

    this.providerSettings.setProviderModels('aigotoken', models)

    const modelStatusMap: Record<string, boolean> = {}
    for (const model of models) {
      modelStatusMap[model.id] = true
    }
    this.providerSettings.batchSetModelStatus('aigotoken', modelStatusMap)

    const defaultModelId = resolveGatewayDefaultModelId(fetched)
    setDefaultModelFallback(defaultModelId ?? '')

    this.publishEvent('models.changed', {
      reason: 'runtime-refresh',
      providerId: 'aigotoken',
      version: Date.now()
    })
  }

  async syncModels(): Promise<boolean> {
    const provider = this.providerSettings.getProviderById('aigotoken')
    if (!provider?.apiKey) {
      return false
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), AIGOTOKEN_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(AIGOTOKEN_MODELS_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${provider.apiKey}`
        },
        signal: controller.signal
      })

      if (!response.ok) {
        return false
      }

      const payload = (await response.json()) as { data?: AigotokenModelRecord[] }

      const usableFetched = filterDeepchatUsable(payload.data || [])
      if (usableFetched.length === 0) {
        return false
      }

      const models = this.mapFetchedModels(usableFetched)

      const existingIds = new Set(
        this.providerSettings.getProviderModels('aigotoken').map((m) => m.id)
      )
      const changed =
        models.length !== existingIds.size || models.some((m) => !existingIds.has(m.id))

      this.providerSettings.setProviderModels('aigotoken', models)

      for (const model of models) {
        this.providerSettings.ensureModelStatus('aigotoken', model.id, true)
      }

      const defaultModelId = resolveGatewayDefaultModelId(usableFetched)
      setDefaultModelFallback(defaultModelId ?? '')

      if (changed) {
        this.publishEvent('models.changed', {
          reason: 'runtime-refresh',
          providerId: 'aigotoken',
          version: Date.now()
        })
      }

      return changed
    } catch (error) {
      console.warn('aigotoken: model sync failed:', sanitizeError(error))
      return false
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
