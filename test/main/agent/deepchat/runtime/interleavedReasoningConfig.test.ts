import { describe, expect, it } from 'vitest'
import { resolveInterleavedReasoningConfig } from '@/agent/deepchat/runtime/generationSettings'

function resolve({
  modelId = 'model-x',
  explicitCompat,
  supportsReasoning = false,
  portrait = null
}: {
  modelId?: string
  explicitCompat?: boolean
  supportsReasoning?: boolean
  portrait?: { supported?: boolean; interleaved?: boolean } | null
}) {
  const generationSettings =
    explicitCompat === undefined ? {} : { forceInterleavedThinkingCompat: explicitCompat }
  return resolveInterleavedReasoningConfig({} as any, 'openai', modelId, generationSettings as any, {
    reasoningPortrait: portrait,
    supportsReasoning
  } as any)
}

describe('resolveInterleavedReasoningConfig preserve policy', () => {
  it('always preserves reasoning content for the deepseek series regardless of explicit opt-out', () => {
    const config = resolve({ modelId: 'deepseek-v4', explicitCompat: false })

    expect(config.preserveReasoningContent).toBe(true)
    expect(config.preserveEmptyReasoningContent).toBe(true)
  })

  it('preserves reasoning content for any reasoning-capable model without an explicit session flag', () => {
    const config = resolve({
      modelId: 'Doubao-Seed-2.0-Pro',
      supportsReasoning: true,
      portrait: { supported: true }
    })

    expect(config.preserveReasoningContent).toBe(true)
    expect(config.preserveEmptyReasoningContent).toBe(false)
  })

  it('keeps reasoning-capable models preserved even when compat is explicitly disabled', () => {
    const config = resolve({
      modelId: 'Doubao-Seed-2.0-Pro',
      explicitCompat: false,
      supportsReasoning: true
    })

    expect(config.preserveReasoningContent).toBe(true)
    expect(config.preserveEmptyReasoningContent).toBe(false)
  })

  it('honors an explicit opt-out for models without native reasoning support', () => {
    const config = resolve({ modelId: 'plain-model', explicitCompat: false })

    expect(config.preserveReasoningContent).toBe(false)
    expect(config.preserveEmptyReasoningContent).toBe(false)
  })

  it('honors an explicit opt-in for models without native reasoning support', () => {
    const config = resolve({ modelId: 'plain-model', explicitCompat: true })

    expect(config.preserveReasoningContent).toBe(true)
    expect(config.preserveEmptyReasoningContent).toBe(false)
  })

  it('preserves reasoning content when the model portrait declares interleaved reasoning', () => {
    const config = resolve({ modelId: 'interleaved-model', portrait: { interleaved: true } })

    expect(config.preserveReasoningContent).toBe(true)
    expect(config.preserveEmptyReasoningContent).toBe(false)
  })

  it('does not preserve reasoning content without deepseek, capability, portrait, or session signal', () => {
    const config = resolve({ modelId: 'plain-model' })

    expect(config.preserveReasoningContent).toBe(false)
    expect(config.preserveEmptyReasoningContent).toBe(false)
  })
})
