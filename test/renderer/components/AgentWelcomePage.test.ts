import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('AgentWelcomePage', () => {
  it('renders up to nine agents and navigates to DeepChat agent settings', async () => {
    vi.resetModules()
    vi.useFakeTimers()

    const settingsClient = {
      openSettings: vi.fn().mockResolvedValue({ windowId: 9 })
    }
    const agentStore = {
      enabledAgents: [
        { id: 'deepchat', name: 'DeepChat', type: 'deepchat', enabled: true },
        ...Array.from({ length: 11 }, (_, index) => ({
          id: `agent-${index + 1}`,
          name: `Agent ${index + 1}`,
          type: index === 0 ? 'deepchat' : 'acp',
          enabled: true
        }))
      ],
      setSelectedAgent: vi.fn()
    }

    vi.doMock('@api/SettingsClient', () => ({
      createSettingsClient: vi.fn(() => settingsClient)
    }))
    vi.doMock('@/stores/ui/agent', () => ({
      useAgentStore: () => agentStore
    }))
    vi.doMock('vue-i18n', () => ({
      useI18n: () => ({
        t: (key: string) =>
          (
            ({
              'welcome.agentPage.title': '选择 Agent 开始创作',
              'welcome.agentPage.manageAgents': '管理 DeepChat Agent',
              'welcome.agentPage.defaultAgentName': '日常助手'
            }) as Record<string, string>
          )[key] ?? key
      })
    }))
    vi.doMock('@iconify/vue', () => ({
      Icon: {
        name: 'Icon',
        template: '<span />'
      }
    }))
    vi.doMock('@/components/icons/AgentAvatar.vue', () => ({
      default: {
        name: 'AgentAvatar',
        props: ['agent'],
        template: '<span class="mock-avatar" :data-agent-id="agent.id" />'
      }
    }))

    const AgentWelcomePage = (await import('@/pages/AgentWelcomePage.vue')).default
    const wrapper = mount(AgentWelcomePage)

    expect(wrapper.text()).toContain('选择 Agent 开始创作')
    expect(wrapper.text()).not.toContain('welcome.agentPage.description')
    expect(wrapper.find('.grid').classes()).toContain('grid-cols-3')
    expect(wrapper.find('img').attributes('src')).toContain('logo-dark.png')

    const headerAvatar = () => wrapper.findAll('.mock-avatar')[0]

    const agentButtons = wrapper
      .findAll('button')
      .filter((button) => button.text().includes('Agent '))

    expect(agentButtons).toHaveLength(8)
    expect(wrapper.text()).not.toContain('Agent 9')
    expect(wrapper.text()).not.toContain('welcome.agentPage.deepchatType')
    expect(wrapper.text()).not.toContain('welcome.agentPage.acpType')

    const builtinButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('日常助手'))
    expect(builtinButton).toBeDefined()
    expect(builtinButton!.text()).not.toContain('DeepChat')

    await builtinButton!.trigger('mouseenter')
    expect(headerAvatar().attributes('data-agent-id')).toBe('deepchat')
    await builtinButton!.trigger('mouseleave')

    await agentButtons[0].trigger('mouseenter')
    expect(headerAvatar().attributes('data-agent-id')).toBe('agent-1')
    expect(wrapper.find('img').exists()).toBe(false)
    await agentButtons[0].trigger('mouseleave')
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('img').attributes('src')).toContain('logo-dark.png')

    await agentButtons[0].trigger('click')
    expect(agentStore.setSelectedAgent).toHaveBeenCalledWith('agent-1')

    const manageButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('管理 DeepChat Agent'))

    expect(manageButton).toBeDefined()

    await manageButton!.trigger('click')
    await vi.runAllTimersAsync()

    expect(settingsClient.openSettings).toHaveBeenCalledTimes(1)
    expect(settingsClient.openSettings).toHaveBeenCalledWith({
      routeName: 'settings-deepchat-agents'
    })
  })
})
