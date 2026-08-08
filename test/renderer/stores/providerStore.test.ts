import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { LLM_PROVIDER } from '@shared/types/provider'

function makeProvider(overrides: Partial<LLM_PROVIDER> = {}): LLM_PROVIDER {
  return {
    id: 'unknown',
    name: 'Unknown',
    apiType: 'openai',
    apiKey: '',
    baseUrl: '',
    enable: false,
    ...overrides
  }
}

const setupStore = async (providers: LLM_PROVIDER[]) => {
  vi.resetModules()

  const providersData = ref<LLM_PROVIDER[] | undefined>(providers)

  vi.doMock('pinia', async () => {
    const actual = await vi.importActual<typeof import('pinia')>('pinia')
    return {
      ...actual,
      defineStore: (_id: string, setup: any) => setup
    }
  })

  vi.doMock('@vueuse/core', async () => {
    const actual = await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core')
    return {
      ...actual,
      useDebounceFn: (fn: (...args: any[]) => void) => fn
    }
  })

  vi.doMock('../../api/ProviderClient', () => ({
    createProviderClient: () => ({
      getProviderSummaries: vi.fn(async () => providersData.value ?? []),
      getDefaultProviders: vi.fn(async () => []),
      getProviderById: vi.fn(),
      setProviderById: vi.fn(),
      updateProviderAtomic: vi.fn(),
      addProviderAtomic: vi.fn(),
      removeProviderAtomic: vi.fn(),
      reorderProvidersAtomic: vi.fn(),
      testConnection: vi.fn(),
      onProvidersChanged: vi.fn()
    })
  }))

  vi.doMock('../../api/ConfigClient', () => ({
    createConfigClient: () => ({
      getSetting: vi.fn(async () => undefined),
      setSetting: vi.fn(async () => undefined),
      getAzureApiVersion: vi.fn(async () => ''),
      setAzureApiVersion: vi.fn(async () => undefined),
      getGeminiSafety: vi.fn(async () => ''),
      setGeminiSafety: vi.fn(async () => undefined),
      getAwsBedrockCredential: vi.fn(async () => null),
      setAwsBedrockCredential: vi.fn(async () => undefined),
      getVoiceAIConfig: vi.fn(async () => null),
      updateVoiceAIConfig: vi.fn(async () => undefined)
    })
  }))

  vi.doMock('@pinia/colada', () => ({
    useQuery: (options: any) => ({
      data: providersData,
      refetch: vi.fn(async () => ({ data: providersData.value })),
      asyncStatus: ref('idle'),
      status: ref(providersData.value ? 'success' : 'idle')
    })
  }))

  const { useProviderStore } = await import('@/stores/providerStore')
  const store = useProviderStore()

  return { store, providersData }
}

describe('providerStore sortedProviders priority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('places aigotoken first among enabled providers regardless of providerOrder', async () => {
    const providers = [
      makeProvider({ id: 'openai', name: 'OpenAI', enable: true }),
      makeProvider({ id: 'anthropic', name: 'Anthropic', enable: true }),
      makeProvider({ id: 'aigotoken', name: 'Aigotoken', enable: true })
    ]

    const { store } = await setupStore(providers)

    store.providerOrder.value = ['openai', 'anthropic', 'aigotoken']
    await nextTick()

    const enabled = store.sortedProviders.value.filter((p) => p.enable)
    expect(enabled[0].id).toBe('aigotoken')
    expect(enabled.map((p) => p.id)).toEqual(['aigotoken', 'openai', 'anthropic'])
  })

  it('keeps aigotoken first even when providerOrder puts it last', async () => {
    const providers = [
      makeProvider({ id: 'openai', name: 'OpenAI', enable: true }),
      makeProvider({ id: 'deepseek', name: 'DeepSeek', enable: true }),
      makeProvider({ id: 'aigotoken', name: 'Aigotoken', enable: true })
    ]

    const { store } = await setupStore(providers)

    store.providerOrder.value = ['openai', 'deepseek', 'aigotoken']
    await nextTick()

    const enabled = store.sortedProviders.value.filter((p) => p.enable)
    expect(enabled[0].id).toBe('aigotoken')
  })

  it('places aigotoken first among disabled providers', async () => {
    const providers = [
      makeProvider({ id: 'openai', name: 'OpenAI', enable: false }),
      makeProvider({ id: 'aigotoken', name: 'Aigotoken', enable: false }),
      makeProvider({ id: 'deepseek', name: 'DeepSeek', enable: false })
    ]

    const { store } = await setupStore(providers)

    store.providerOrder.value = ['openai', 'deepseek', 'aigotoken']
    await nextTick()

    const disabled = store.sortedProviders.value.filter((p) => !p.enable)
    expect(disabled[0].id).toBe('aigotoken')
  })

  it('puts enabled aigotoken before all other enabled providers in sortedProviders', async () => {
    const providers = [
      makeProvider({ id: 'openai', name: 'OpenAI', enable: true }),
      makeProvider({ id: 'aigotoken', name: 'Aigotoken', enable: true }),
      makeProvider({ id: 'deepseek', name: 'DeepSeek', enable: false })
    ]

    const { store } = await setupStore(providers)

    store.providerOrder.value = ['openai', 'aigotoken', 'deepseek']
    await nextTick()

    expect(store.sortedProviders.value[0].id).toBe('aigotoken')
    expect(store.sortedProviders.value[0].enable).toBe(true)
  })
})
