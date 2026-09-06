import { describe, expect, it } from 'vitest'
import {
  DERIVED_MODEL_MAX_TOKENS_CAP,
  DEFAULT_MODEL_MAX_TOKENS,
  resolveDerivedModelMaxTokens,
  resolveModelMaxTokens
} from '../../../src/shared/modelConfigDefaults'

describe('resolveDerivedModelMaxTokens', () => {
  it('caps large derived values at 100000', () => {
    expect(resolveDerivedModelMaxTokens(200000)).toBe(100000)
  })

  it('keeps exact cap values', () => {
    expect(resolveDerivedModelMaxTokens(100000)).toBe(100000)
  })

  it('keeps values below the cap', () => {
    expect(resolveDerivedModelMaxTokens(8192)).toBe(8192)
  })

  it('falls back to the default when metadata is missing', () => {
    expect(resolveDerivedModelMaxTokens(undefined)).toBe(DEFAULT_MODEL_MAX_TOKENS)
  })

  it('clamps zero to a sane positive minimum', () => {
    expect(resolveDerivedModelMaxTokens(0)).toBe(1)
  })

  it('clamps negative values to a sane positive minimum', () => {
    expect(resolveDerivedModelMaxTokens(-1024)).toBe(1)
  })

  it('clamps NaN to a sane positive minimum', () => {
    expect(resolveDerivedModelMaxTokens(Number.NaN)).toBe(1)
  })
})

describe('resolveModelMaxTokens', () => {
  it('preserves user-sized values above the derived cap', () => {
    expect(resolveModelMaxTokens(64000)).toBe(64000)
  })

  it('exports the shared derived cap constant', () => {
    expect(DERIVED_MODEL_MAX_TOKENS_CAP).toBe(100000)
  })
})
