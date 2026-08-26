import { describe, expect, it } from 'vitest'
import { AgentPresetDefinitionSchema } from '@shared/contracts/domainSchemas'

describe('AgentPresetDefinitionSchema', () => {
  it('accepts a minimal preset with an allow-listed skill set', () => {
    const result = AgentPresetDefinitionSchema.safeParse({
      id: 'deepchat-code-expert',
      name: '代码专家',
      description: '专注于软件工程与代码任务的助手',
      icon: 'agentpreset://deepchat-code-expert.svg',
      systemPrompt: 'You are a code expert.',
      enabledSkillNames: ['code-review', 'git-commit']
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({
        id: 'deepchat-code-expert',
        icon: 'agentpreset://deepchat-code-expert.svg',
        enabledSkillNames: ['code-review', 'git-commit']
      })
    }
  })

  it('accepts a preset without skill restrictions', () => {
    expect(
      AgentPresetDefinitionSchema.safeParse({ id: 'deepchat-general', name: '通用助手' }).success
    ).toBe(true)
  })

  it('rejects ids that are not safe skill agent ids', () => {
    expect(
      AgentPresetDefinitionSchema.safeParse({ id: 'has space', name: 'Invalid' }).success
    ).toBe(false)
    expect(
      AgentPresetDefinitionSchema.safeParse({ id: '-leading-dash', name: 'Invalid' }).success
    ).toBe(false)
    expect(
      AgentPresetDefinitionSchema.safeParse({ id: '../escape', name: 'Invalid' }).success
    ).toBe(false)
    expect(AgentPresetDefinitionSchema.safeParse({ id: '', name: 'Invalid' }).success).toBe(false)
  })

  it('rejects a missing or empty name', () => {
    expect(AgentPresetDefinitionSchema.safeParse({ id: 'valid-id', name: '' }).success).toBe(false)
    expect(AgentPresetDefinitionSchema.safeParse({ id: 'valid-id' }).success).toBe(false)
  })
})
