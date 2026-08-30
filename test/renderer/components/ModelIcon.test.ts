import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'

const { openExternal } = vi.hoisted(() => ({ openExternal: vi.fn() }))

const providerStore = reactive({
  providers: [] as Array<{ id: string; apiType?: string; websites?: { official: string } }>
})

const agentStoreState = reactive({
  agents: [] as Array<{ id: string; type?: string; icon?: string; avatar?: unknown }>
})

vi.mock('@/stores/providerStore', () => ({
  useProviderStore: () => providerStore
}))

vi.mock('@/stores/ui/agent', () => ({
  useAgentStore: () => agentStoreState
}))

vi.mock('@api/BrowserClient', () => ({
  createBrowserClient: () => ({ openExternal })
}))

describe('ModelIcon', () => {
  beforeEach(() => {
    providerStore.providers = []
    agentStoreState.agents = []
    openExternal.mockReset()
    openExternal.mockResolvedValue(undefined)
  })

  it('resolves dimcode-acp to the DimCode icon', async () => {
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const dimcodeIcon = (await import('@/assets/llm-icons/dimcode.svg?url')).default
    const wrapper = mount(ModelIcon, {
      props: {
        modelId: 'dimcode-acp'
      }
    })

    const image = wrapper.get('img')

    expect(image.attributes('alt')).toBe('dimcode')
    expect(image.attributes('src')).toBe(dimcodeIcon)
  })

  it('resolves novita to the novita.ai icon', async () => {
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const novitaAiIcon = (await import('@/assets/llm-icons/novitaai.svg?url')).default
    const wrapper = mount(ModelIcon, {
      props: {
        modelId: 'novita'
      }
    })

    const image = wrapper.get('img')

    expect(image.attributes('alt')).toBe('novita')
    expect(image.attributes('src')).toBe(novitaAiIcon)
  })

  it('resolves mistral to the Mistral icon', async () => {
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const mistralIcon = (await import('@/assets/llm-icons/mistral-color.svg?url')).default
    const wrapper = mount(ModelIcon, {
      props: {
        modelId: 'mistral'
      }
    })

    const image = wrapper.get('img')

    expect(image.attributes('alt')).toBe('mistral')
    expect(image.attributes('src')).toBe(mistralIcon)
  })

  it('resolves kimi-for-coding to the Kimi color icon', async () => {
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const kimiIcon = (await import('@/assets/llm-icons/kimi-color.svg?url')).default
    const wrapper = mount(ModelIcon, {
      props: {
        modelId: 'kimi-for-coding'
      }
    })

    const image = wrapper.get('img')

    expect(image.attributes('alt')).toBe('kimi-for-coding')
    expect(image.attributes('src')).toBe(kimiIcon)
  })

  it('resolves the basic API-key provider icons', async () => {
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const nvidiaIcon = (await import('@/assets/llm-icons/nvidia-color.svg?url')).default
    const huggingFaceIcon = (await import('@/assets/llm-icons/huggingface-color.svg?url')).default
    const alibabaIcon = (await import('@/assets/llm-icons/alibabacloud-color.svg?url')).default
    const tokenlabIcon = (await import('@/assets/llm-icons/tokenlab.webp?url')).default
    const daoxeIcon = (await import('@/assets/llm-icons/daoxe.png?url')).default
    const greenptIcon = (await import('@/assets/llm-icons/greenpt.svg?url')).default
    const modelsellIcon = (await import('@/assets/llm-icons/modelsell.png?url')).default
    const orcarouterIcon = (await import('@/assets/llm-icons/orcarouter.svg?url')).default

    const nvidia = mount(ModelIcon, {
      props: {
        modelId: 'nvidia'
      }
    })
    const huggingface = mount(ModelIcon, {
      props: {
        modelId: 'huggingface'
      }
    })
    const alibabaTokenPlan = mount(ModelIcon, {
      props: {
        modelId: 'alibaba-token-plan'
      }
    })
    const tokenlab = mount(ModelIcon, {
      props: {
        modelId: 'tokenlab'
      }
    })
    const daoxe = mount(ModelIcon, {
      props: {
        modelId: 'daoxe'
      }
    })
    const greenpt = mount(ModelIcon, {
      props: {
        modelId: 'greenpt'
      }
    })
    const modelsell = mount(ModelIcon, {
      props: {
        modelId: 'modelsell'
      }
    })
    const orcarouter = mount(ModelIcon, {
      props: {
        modelId: 'orcarouter'
      }
    })

    expect(nvidia.get('img').attributes('src')).toBe(nvidiaIcon)
    expect(huggingface.get('img').attributes('src')).toBe(huggingFaceIcon)
    expect(alibabaTokenPlan.get('img').attributes('src')).toBe(alibabaIcon)
    expect(tokenlab.get('img').attributes('src')).toBe(tokenlabIcon)
    expect(daoxe.get('img').attributes('src')).toBe(daoxeIcon)
    expect(greenpt.get('img').attributes('src')).toBe(greenptIcon)
    expect(modelsell.get('img').attributes('src')).toBe(modelsellIcon)
    expect(orcarouter.get('img').attributes('src')).toBe(orcarouterIcon)
  })

  it('keeps fuzzy matching for common model ids and provider apiType fallback', async () => {
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const openaiIcon = (await import('@/assets/llm-icons/openai.svg?url')).default
    const claudeIcon = (await import('@/assets/llm-icons/claude-color.svg?url')).default
    const geminiIcon = (await import('@/assets/llm-icons/gemini-color.svg?url')).default

    const gpt = mount(ModelIcon, {
      props: {
        modelId: 'gpt-4o'
      }
    })
    const claude = mount(ModelIcon, {
      props: {
        modelId: 'claude-3-5-sonnet'
      }
    })
    const gemini = mount(ModelIcon, {
      props: {
        modelId: 'gemini-2.5-pro'
      }
    })

    providerStore.providers = [{ id: 'custom-openai-compatible', apiType: 'openai' }]
    const apiTypeFallback = mount(ModelIcon, {
      props: {
        modelId: 'custom-openai-compatible'
      }
    })

    expect(gpt.get('img').attributes('alt')).toBe('gpt')
    expect(gpt.get('img').attributes('src')).toBe(openaiIcon)
    expect(claude.get('img').attributes('alt')).toBe('claude')
    expect(claude.get('img').attributes('src')).toBe(claudeIcon)
    expect(gemini.get('img').attributes('alt')).toBe('gemini')
    expect(gemini.get('img').attributes('src')).toBe(geminiIcon)
    expect(apiTypeFallback.get('img').attributes('alt')).toBe('openai')
    expect(apiTypeFallback.get('img').attributes('src')).toBe(openaiIcon)
  })

  it('resolves aigotoken to the aigotoken icon', async () => {
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const aigotokenIcon = (await import('@/assets/llm-icons/aigotoken.svg?url')).default
    const wrapper = mount(ModelIcon, {
      props: {
        modelId: 'aigotoken'
      }
    })

    const image = wrapper.get('img')

    expect(image.attributes('alt')).toBe('aigotoken')
    expect(image.attributes('src')).toBe(aigotokenIcon)
  })

  it('opens the provider official website when a linkable icon is clicked', async () => {
    providerStore.providers = [
      {
        id: 'aigotoken',
        apiType: 'new-api',
        websites: { official: 'https://www.aigotoken.com', apiKey: '' }
      }
    ]
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const wrapper = mount(ModelIcon, {
      props: {
        modelId: 'aigotoken',
        linkable: true
      }
    })

    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://www.aigotoken.com')

    await link.trigger('click')

    expect(openExternal).toHaveBeenCalledWith('https://www.aigotoken.com')
  })

  it('resolves the agent icon when agentId matches an agent', async () => {
    agentStoreState.agents = [
      {
        id: 'deepchat-code-expert',
        type: 'deepchat',
        icon: 'agentpreset://deepchat-code-expert.svg'
      }
    ]
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const wrapper = mount(ModelIcon, {
      props: {
        modelId: 'aigotoken',
        agentId: 'deepchat-code-expert'
      }
    })

    const image = wrapper.get('img')

    expect(image.attributes('src')).toBe('agentpreset://deepchat-code-expert.svg')
  })

  it('renders the builtin deepchat logo when the agent has no icon', async () => {
    agentStoreState.agents = [{ id: 'deepchat', type: 'deepchat', icon: '' }]
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const deepchatLogo = (await import('@/assets/logo.png?url')).default
    const wrapper = mount(ModelIcon, {
      props: {
        modelId: 'aigotoken',
        agentId: 'deepchat'
      }
    })

    const image = wrapper.get('img')

    expect(image.attributes('src')).toBe(deepchatLogo)
  })

  it('keeps the provider website link when agentId is provided', async () => {
    agentStoreState.agents = [
      {
        id: 'deepchat-code-expert',
        type: 'deepchat',
        icon: 'agentpreset://deepchat-code-expert.svg'
      }
    ]
    providerStore.providers = [
      {
        id: 'aigotoken',
        apiType: 'new-api',
        websites: { official: 'https://www.aigotoken.com', apiKey: '' }
      }
    ]
    const ModelIcon = (await import('@/components/icons/ModelIcon.vue')).default
    const wrapper = mount(ModelIcon, {
      props: {
        modelId: 'aigotoken',
        agentId: 'deepchat-code-expert',
        linkable: true
      }
    })

    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://www.aigotoken.com')

    await link.trigger('click')

    expect(openExternal).toHaveBeenCalledWith('https://www.aigotoken.com')
  })
})
