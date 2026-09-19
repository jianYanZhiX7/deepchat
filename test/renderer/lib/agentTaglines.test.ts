import { describe, expect, it } from 'vitest'
import { pickAgentTagline, resolveAgentTaglines } from '@/lib/agentTaglines'

describe('agent taglines', () => {
  it('resolves built-in agent pools and falls back for unknown agents', () => {
    expect(resolveAgentTaglines('deepchat-code-expert')).toContain('先读懂，再动手')
    expect(resolveAgentTaglines('deepchat-data-analyst')).toContain('让数据说话')
    expect(resolveAgentTaglines('deepchat-researcher')).toContain('把问题查清楚')
    expect(resolveAgentTaglines('deepchat-writing-assistant')).toContain('让表达更有力量')

    const fallback = resolveAgentTaglines(null)
    expect(fallback).toBe(resolveAgentTaglines('unknown-agent'))
    expect(fallback).not.toBe(resolveAgentTaglines('deepchat'))
  })

  it('avoids repeating the previous tagline when alternatives exist', () => {
    const taglines = resolveAgentTaglines('deepchat-researcher')
    const first = pickAgentTagline('deepchat-researcher', null, () => 0)
    const next = pickAgentTagline('deepchat-researcher', first, () => 0)

    expect(first).toBe(taglines[0])
    expect(next).toBe(taglines[1])
  })

  it('keeps the pool when the previous tagline is not part of it', () => {
    const taglines = resolveAgentTaglines('deepchat')

    expect(pickAgentTagline('deepchat', '不存在的标语', () => 0)).toBe(taglines[0])
  })
})
