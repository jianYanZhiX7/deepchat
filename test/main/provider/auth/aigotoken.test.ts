import { shell } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AigotokenAuth } from '@/provider/auth/aigotoken'
import { createAigotokenPkcePair, createAigotokenState } from '@/provider/auth/aigotoken/pkce'
import type { LLM_PROVIDER, MODEL_META } from '@shared/types/provider'

const { startOAuthLoopbackCallbackSessionMock } = vi.hoisted(() => ({
  startOAuthLoopbackCallbackSessionMock: vi.fn()
}))

vi.mock('@/provider/auth/oauthLoopbackCallback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/provider/auth/oauthLoopbackCallback')>()
  return {
    ...actual,
    startOAuthLoopbackCallbackSession: startOAuthLoopbackCallbackSessionMock
  }
})

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  })
}

function makeProvider(overrides: Partial<LLM_PROVIDER> = {}): LLM_PROVIDER {
  return {
    id: 'aigotoken',
    name: 'Aigotoken',
    apiType: 'new-api',
    apiKey: '',
    baseUrl: 'https://www.aigotoken.com/v1',
    enable: false,
    ...overrides
  }
}

function makeProviderStore(initial?: LLM_PROVIDER) {
  let stored = initial ?? makeProvider()
  let storedModels: MODEL_META[] = []
  return {
    getProviderById: vi.fn((_id: string) => stored),
    setProviderById: vi.fn((_id: string, provider: LLM_PROVIDER) => {
      stored = provider
    }),
    setProviderModels: vi.fn((_id: string, models: MODEL_META[]) => {
      storedModels = models
    }),
    batchSetModelStatus: vi.fn(),
    getStoredModels: () => storedModels
  }
}

describe('Aigotoken auth', () => {
  let provider: LLM_PROVIDER

  beforeEach(() => {
    provider = makeProvider()
    startOAuthLoopbackCallbackSessionMock.mockReset()
    vi.mocked(shell.openExternal).mockClear()
    delete process.env.AIGOTOKEN_REDIRECT_PORT
    delete process.env.AIGOTOKEN_REDIRECT_URI
    delete process.env.AIGOTOKEN_BROWSER_TIMEOUT_MS
    delete process.env.AIGOTOKEN_REQUEST_TIMEOUT_MS
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('creates URL-safe PKCE verifier and challenge values', () => {
    const pair = createAigotokenPkcePair()

    expect(pair.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(pair.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(pair.codeVerifier).not.toBe(pair.codeChallenge)
  })

  it('creates hex state strings', () => {
    const state = createAigotokenState()
    expect(state).toMatch(/^[0-9a-f]{32}$/)
  })

  it('falls back when the redirect port env value is invalid', async () => {
    vi.resetModules()
    process.env.AIGOTOKEN_REDIRECT_PORT = '1456.5'
    const decimalPortConstants = await import('@/provider/auth/aigotoken/constants')
    expect(decimalPortConstants.AIGOTOKEN_REDIRECT_PORT).toBe(1456)

    vi.resetModules()
    process.env.AIGOTOKEN_REDIRECT_PORT = '70000'
    const outOfRangePortConstants = await import('@/provider/auth/aigotoken/constants')
    expect(outOfRangePortConstants.AIGOTOKEN_REDIRECT_PORT).toBe(1456)

    vi.resetModules()
    process.env.AIGOTOKEN_REDIRECT_PORT = '65535'
    const validPortConstants = await import('@/provider/auth/aigotoken/constants')
    expect(validPortConstants.AIGOTOKEN_REDIRECT_PORT).toBe(65535)
  })

  it('respects the AIGOTOKEN_REDIRECT_URI env override', async () => {
    vi.resetModules()
    process.env.AIGOTOKEN_REDIRECT_URI = 'http://127.0.0.1:9999/custom/callback'
    const constants = await import('@/provider/auth/aigotoken/constants')
    expect(constants.AIGOTOKEN_REDIRECT_URI).toBe('http://127.0.0.1:9999/custom/callback')
  })

  it('reports signed-out status when no apiKey is set', () => {
    const auth = new AigotokenAuth(
      {
        getProviderById: () => provider,
        setProviderById: () => {},
        setProviderModels: () => {},
        batchSetModelStatus: () => {}
      },
      vi.fn()
    )

    expect(auth.getStatus()).toEqual({
      state: 'signed-out',
      authenticated: false
    })
  })

  it('reports authenticated status when apiKey is set', () => {
    provider.apiKey = 'sk-test-key'
    const auth = new AigotokenAuth(
      {
        getProviderById: () => provider,
        setProviderById: () => {},
        setProviderModels: () => {},
        batchSetModelStatus: () => {}
      },
      vi.fn()
    )

    expect(auth.getStatus()).toEqual({
      state: 'authenticated',
      authenticated: true
    })
  })

  it('reports error status when lastError is set and no apiKey', () => {
    const auth = new AigotokenAuth(
      {
        getProviderById: () => provider,
        setProviderById: () => {},
        setProviderModels: () => {},
        batchSetModelStatus: () => {}
      },
      vi.fn()
    )

    // Force an error by trying to complete a non-existent flow
    auth.completeBrowserLoginFromCallbackUrl(
      'http://localhost:1456/oauth/aigotoken/callback?code=x&state=y'
    )

    expect(auth.getStatus().state).toBe('error')
    expect(auth.getStatus().error).toBeTruthy()
  })

  it('clears error on subsequent startBrowserLogin attempts', async () => {
    const auth = new AigotokenAuth(
      {
        getProviderById: () => provider,
        setProviderById: () => {},
        setProviderModels: () => {},
        batchSetModelStatus: () => {}
      },
      vi.fn()
    )

    // Force an error
    auth.completeBrowserLoginFromCallbackUrl(
      'http://localhost:1456/oauth/aigotoken/callback?code=x&state=y'
    )
    expect(auth.getStatus().state).toBe('error')

    // Start a new login attempt should clear the error
    startOAuthLoopbackCallbackSessionMock.mockRejectedValueOnce(new Error('port in use'))
    await auth.startBrowserLogin()
    expect(auth.getStatus().state).toBe('error')
    expect(auth.getStatus().error).toBe('port in use')
  })

  it('opens browser login and transitions to pending-browser state', async () => {
    startOAuthLoopbackCallbackSessionMock.mockImplementationOnce(
      async (options: { expectedState: string; path: string }) => {
        const callbackPath = options.path.startsWith('/') ? options.path : `/${options.path}`
        const redirectUri = `http://localhost:1456${callbackPath}`
        let resolveCallback!: (value: { code: string }) => void
        const callbackPromise = new Promise<{ code: string }>((resolve) => {
          resolveCallback = resolve
        })

        return {
          redirectUri,
          waitForCallback: vi.fn(() => callbackPromise),
          resolveCallbackUrl: vi.fn((rawUrl: string) => {
            const callbackUrl = new URL(rawUrl)
            const code = callbackUrl.searchParams.get('code')
            const state = callbackUrl.searchParams.get('state')
            if (!code || state !== options.expectedState) {
              return {
                kind: 'failure' as const,
                error: new Error('Invalid callback'),
                url: callbackUrl.toString()
              }
            }
            const result = { kind: 'success' as const, code, state, url: callbackUrl.toString() }
            resolveCallback(result)
            return result
          }),
          close: vi.fn()
        }
      }
    )

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)
      if (url.includes('/api/oauth/token')) {
        return jsonResponse({ access_token: 'sk-browser-token', token_type: 'bearer' })
      }
      if (url.includes('/v1/models')) {
        return jsonResponse({ data: [{ id: 'gpt-4', owned_by: 'openai' }] })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = makeProviderStore()
    const auth = new AigotokenAuth(store, vi.fn())

    const status = await auth.startBrowserLogin()
    const authUrl = new URL(vi.mocked(shell.openExternal).mock.calls[0][0])
    const redirectUri = authUrl.searchParams.get('redirect_uri')!
    const state = authUrl.searchParams.get('state')!

    expect(status.state).toBe('pending-browser')
    expect(shell.openExternal).toHaveBeenCalledWith(
      expect.stringContaining('https://www.aigotoken.com/oauth/authorize')
    )
    expect(authUrl.searchParams.get('client_id')).toBe('deepchat')
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authUrl.searchParams.get('response_type')).toBe('code')

    // Simulate callback
    const callbackUrl = new URL(redirectUri)
    callbackUrl.searchParams.set('code', 'auth-code-123')
    callbackUrl.searchParams.set('state', state)
    await auth.completeBrowserLoginFromCallbackUrl(callbackUrl.toString())

    await vi.waitFor(() => {
      expect(auth.getStatus().authenticated).toBe(true)
    })

    expect(store.setProviderById).toHaveBeenCalledWith(
      'aigotoken',
      expect.objectContaining({ apiKey: 'sk-browser-token', enable: true })
    )
    expect(store.batchSetModelStatus).toHaveBeenCalledWith('aigotoken', {
      'gpt-4': true
    })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/oauth/token'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: expect.any(String)
      })
    )

    const tokenCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/api/oauth/token')
    )!
    const tokenInit = tokenCall[1] as RequestInit
    const tokenBody = JSON.parse(String(tokenInit.body))
    expect(tokenBody).toMatchObject({
      grant_type: 'authorization_code',
      client_id: 'deepchat',
      code: 'auth-code-123',
      redirect_uri: redirectUri
    })
    expect(tokenBody.code_verifier).toBeTruthy()
  })

  it('fetches and stores models after successful auth', async () => {
    startOAuthLoopbackCallbackSessionMock.mockImplementationOnce(
      async (options: { expectedState: string; path: string }) => {
        const callbackPath = options.path.startsWith('/') ? options.path : `/${options.path}`
        const redirectUri = `http://localhost:1456${callbackPath}`
        let resolveCallback!: (value: { code: string }) => void
        const callbackPromise = new Promise<{ code: string }>((resolve) => {
          resolveCallback = resolve
        })

        return {
          redirectUri,
          waitForCallback: vi.fn(() => callbackPromise),
          resolveCallbackUrl: vi.fn((rawUrl: string) => {
            const callbackUrl = new URL(rawUrl)
            const code = callbackUrl.searchParams.get('code')!
            const state = callbackUrl.searchParams.get('state')!
            const result = { kind: 'success' as const, code, state, url: callbackUrl.toString() }
            resolveCallback(result)
            return result
          }),
          close: vi.fn()
        }
      }
    )

    const modelsData = [
      { id: 'gpt-4', owned_by: 'openai' },
      { id: 'claude-3', owned_by: 'anthropic' }
    ]

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.includes('/api/oauth/token')) {
        return jsonResponse({ access_token: 'sk-models-token', token_type: 'bearer' })
      }
      if (url.includes('/v1/models')) {
        return jsonResponse({ data: modelsData })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = makeProviderStore()
    const publishEvent = vi.fn()
    const auth = new AigotokenAuth(store, publishEvent)

    await auth.startBrowserLogin()

    const openExternalCall = vi.mocked(shell.openExternal).mock.calls[0][0]
    const authUrl = new URL(openExternalCall)
    const redirectUri = authUrl.searchParams.get('redirect_uri')!
    const state = authUrl.searchParams.get('state')!

    const callbackUrl = new URL(redirectUri)
    callbackUrl.searchParams.set('code', 'auth-code')
    callbackUrl.searchParams.set('state', state)
    await auth.completeBrowserLoginFromCallbackUrl(callbackUrl.toString())

    await vi.waitFor(() => {
      expect(auth.getStatus().authenticated).toBe(true)
    })

    expect(store.setProviderModels).toHaveBeenCalledWith('aigotoken', expect.any(Array))
    const models: MODEL_META[] = store.setProviderModels.mock.calls[0][1]
    expect(models).toHaveLength(2)
    expect(models[0]).toMatchObject({ id: 'gpt-4', providerId: 'aigotoken', enabled: true })
    expect(models[1]).toMatchObject({ id: 'claude-3', group: 'aigotoken' })

    expect(store.setProviderById).toHaveBeenCalledWith(
      'aigotoken',
      expect.objectContaining({ apiKey: 'sk-models-token', enable: true })
    )
    expect(store.batchSetModelStatus).toHaveBeenCalledWith('aigotoken', {
      'gpt-4': true,
      'claude-3': true
    })

    expect(publishEvent).toHaveBeenCalledWith(
      'models.changed',
      expect.objectContaining({
        reason: 'runtime-refresh',
        providerId: 'aigotoken'
      })
    )
  })

  it('still succeeds auth even when model fetch fails', async () => {
    startOAuthLoopbackCallbackSessionMock.mockImplementationOnce(
      async (options: { expectedState: string; path: string }) => {
        const callbackPath = options.path.startsWith('/') ? options.path : `/${options.path}`
        const redirectUri = `http://localhost:1456${callbackPath}`
        let resolveCallback!: (value: { code: string }) => void
        const callbackPromise = new Promise<{ code: string }>((resolve) => {
          resolveCallback = resolve
        })

        return {
          redirectUri,
          waitForCallback: vi.fn(() => callbackPromise),
          resolveCallbackUrl: vi.fn((rawUrl: string) => {
            const callbackUrl = new URL(rawUrl)
            const code = callbackUrl.searchParams.get('code')!
            const state = callbackUrl.searchParams.get('state')!
            const result = { kind: 'success' as const, code, state, url: callbackUrl.toString() }
            resolveCallback(result)
            return result
          }),
          close: vi.fn()
        }
      }
    )

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.includes('/api/oauth/token')) {
        return jsonResponse({ access_token: 'sk-resilient-token', token_type: 'bearer' })
      }
      if (url.includes('/v1/models')) {
        return new Response('Internal Server Error', { status: 500 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = makeProviderStore()
    const auth = new AigotokenAuth(store, vi.fn())

    await auth.startBrowserLogin()

    const authUrl = new URL(vi.mocked(shell.openExternal).mock.calls[0][0])
    const redirectUri = authUrl.searchParams.get('redirect_uri')!
    const state = authUrl.searchParams.get('state')!

    const callbackUrl = new URL(redirectUri)
    callbackUrl.searchParams.set('code', 'auth-code')
    callbackUrl.searchParams.set('state', state)
    await auth.completeBrowserLoginFromCallbackUrl(callbackUrl.toString())

    await vi.waitFor(() => {
      expect(auth.getStatus().authenticated).toBe(true)
    })

    // apiKey should be set even though model fetch failed
    expect(store.setProviderById).toHaveBeenCalledWith(
      'aigotoken',
      expect.objectContaining({ apiKey: 'sk-resilient-token' })
    )
  })

  it('cancels pending login and returns to signed-out', async () => {
    startOAuthLoopbackCallbackSessionMock.mockImplementationOnce(
      async (options: { expectedState: string; path: string }) => {
        const callbackPath = options.path.startsWith('/') ? options.path : `/${options.path}`
        const redirectUri = `http://localhost:1456${callbackPath}`
        const callbackPromise = new Promise<{ code: string }>(() => {
          // never resolves
        })

        return {
          redirectUri,
          waitForCallback: vi.fn(() => callbackPromise),
          resolveCallbackUrl: vi.fn(() => ({ kind: 'not-found' as const })),
          close: vi.fn()
        }
      }
    )

    const auth = new AigotokenAuth(
      {
        getProviderById: () => provider,
        setProviderById: () => {},
        setProviderModels: () => {},
        batchSetModelStatus: () => {}
      },
      vi.fn()
    )

    await auth.startBrowserLogin()
    expect(auth.getStatus().state).toBe('pending-browser')

    const status = auth.cancelLogin()
    expect(status.state).toBe('signed-out')
  })

  it('logs out by clearing apiKey and keeping provider entry', () => {
    const store = makeProviderStore(makeProvider({ apiKey: 'sk-to-be-cleared' }))
    const auth = new AigotokenAuth(store, vi.fn())

    expect(auth.getStatus().authenticated).toBe(true)

    auth.logout()

    expect(store.setProviderById).toHaveBeenCalledWith(
      'aigotoken',
      expect.objectContaining({ apiKey: '' })
    )
    expect(auth.getStatus().authenticated).toBe(false)
  })

  it('publishes status change events', async () => {
    const publishEvent = vi.fn()

    startOAuthLoopbackCallbackSessionMock.mockRejectedValueOnce(new Error('test error'))

    const auth = new AigotokenAuth(
      {
        getProviderById: () => provider,
        setProviderById: () => {},
        setProviderModels: () => {},
        batchSetModelStatus: () => {}
      },
      publishEvent
    )

    await auth.startBrowserLogin()

    expect(publishEvent).toHaveBeenCalledWith(
      'oauth.aigotoken.statusChanged',
      expect.objectContaining({
        status: expect.objectContaining({ state: 'error' }),
        version: expect.any(Number)
      })
    )
  })

  it('handles token endpoint errors gracefully', async () => {
    startOAuthLoopbackCallbackSessionMock.mockImplementationOnce(
      async (options: { expectedState: string; path: string }) => {
        const callbackPath = options.path.startsWith('/') ? options.path : `/${options.path}`
        const redirectUri = `http://localhost:1456${callbackPath}`
        let resolveCallback!: (value: { code: string }) => void
        const callbackPromise = new Promise<{ code: string }>((resolve) => {
          resolveCallback = resolve
        })

        return {
          redirectUri,
          waitForCallback: vi.fn(() => callbackPromise),
          resolveCallbackUrl: vi.fn((rawUrl: string) => {
            const callbackUrl = new URL(rawUrl)
            const code = callbackUrl.searchParams.get('code')!
            const state = callbackUrl.searchParams.get('state')!
            const result = { kind: 'success' as const, code, state, url: callbackUrl.toString() }
            resolveCallback(result)
            return result
          }),
          close: vi.fn()
        }
      }
    )

    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(
        JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid code' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const auth = new AigotokenAuth(
      {
        getProviderById: () => provider,
        setProviderById: () => {},
        setProviderModels: () => {},
        batchSetModelStatus: () => {}
      },
      vi.fn()
    )

    await auth.startBrowserLogin()

    const authUrl = new URL(vi.mocked(shell.openExternal).mock.calls[0][0])
    const redirectUri = authUrl.searchParams.get('redirect_uri')!
    const state = authUrl.searchParams.get('state')!

    const callbackUrl = new URL(redirectUri)
    callbackUrl.searchParams.set('code', 'bad-code')
    callbackUrl.searchParams.set('state', state)
    await auth.completeBrowserLoginFromCallbackUrl(callbackUrl.toString())

    await vi.waitFor(() => {
      expect(auth.getStatus().state).toBe('error')
    })
    expect(auth.getStatus().error).toContain('Invalid code')
  })

  it('sanitizes error messages to prevent key leakage', async () => {
    startOAuthLoopbackCallbackSessionMock.mockImplementationOnce(
      async (options: { expectedState: string; path: string }) => {
        const callbackPath = options.path.startsWith('/') ? options.path : `/${options.path}`
        const redirectUri = `http://localhost:1456${callbackPath}`
        let resolveCallback!: (value: { code: string }) => void
        const callbackPromise = new Promise<{ code: string }>((resolve) => {
          resolveCallback = resolve
        })

        return {
          redirectUri,
          waitForCallback: vi.fn(() => callbackPromise),
          resolveCallbackUrl: vi.fn((rawUrl: string) => {
            const callbackUrl = new URL(rawUrl)
            const code = callbackUrl.searchParams.get('code')!
            const state = callbackUrl.searchParams.get('state')!
            const result = { kind: 'success' as const, code, state, url: callbackUrl.toString() }
            resolveCallback(result)
            return result
          }),
          close: vi.fn()
        }
      }
    )

    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new Error('Failed with access_token=sk-secret-leaked-key-123 and Bearer eyJhbGciOiJI')
    })
    vi.stubGlobal('fetch', fetchMock)

    const auth = new AigotokenAuth(
      {
        getProviderById: () => provider,
        setProviderById: () => {},
        setProviderModels: () => {},
        batchSetModelStatus: () => {}
      },
      vi.fn()
    )

    await auth.startBrowserLogin()

    const authUrl = new URL(vi.mocked(shell.openExternal).mock.calls[0][0])
    const redirectUri = authUrl.searchParams.get('redirect_uri')!
    const state = authUrl.searchParams.get('state')!

    const callbackUrl = new URL(redirectUri)
    callbackUrl.searchParams.set('code', 'test-code')
    callbackUrl.searchParams.set('state', state)
    await auth.completeBrowserLoginFromCallbackUrl(callbackUrl.toString())

    await vi.waitFor(() => {
      expect(auth.getStatus().state).toBe('error')
    })

    const error = auth.getStatus().error!
    expect(error).toContain('access_token:[redacted]')
    expect(error).toContain('Bearer [redacted]')
    expect(error).not.toContain('sk-secret-leaked-key-123')
    expect(error).not.toContain('eyJhbGciOiJI')
  })
})
