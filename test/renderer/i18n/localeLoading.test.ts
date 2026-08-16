import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', async () => vi.importActual('vue-i18n'))

import { createRendererI18n } from '@/i18n/bootstrap'
import {
  FALLBACK_LOCALE,
  loadLocaleMessages,
  resolveSupportedLocale,
  type RendererLocaleMessages
} from '@/i18n'

const createMessages = (label: string): RendererLocaleMessages => ({
  common: {
    label
  }
})

describe('renderer locale loading', () => {
  it('normalizes supported locales and language aliases', () => {
    expect(resolveSupportedLocale('zh_TW')).toBe('zh-TW')
    expect(resolveSupportedLocale('zh-Hant-HK')).toBe('zh-HK')
    expect(resolveSupportedLocale('fr-CA')).toBe('fr-FR')
    expect(resolveSupportedLocale('PT')).toBe('pt-BR')
    expect(resolveSupportedLocale('unknown')).toBe(FALLBACK_LOCALE)
    expect(resolveSupportedLocale(undefined)).toBe(FALLBACK_LOCALE)
  })

  it('reuses the same locale import promise', async () => {
    const firstLoad = loadLocaleMessages('en-US')
    const secondLoad = loadLocaleMessages('en')

    expect(secondLoad).toBe(firstLoad)
    expect(await firstLoad).toHaveProperty('common')
  })

  it('renders literal search placeholders and named confirmation parameters', async () => {
    const messages = await loadLocaleMessages('en-US')
    const { i18n } = await createRendererI18n({
      getLanguageState: async () => ({
        requestedLanguage: 'en-US',
        locale: 'en-US',
        direction: 'auto'
      }),
      loadMessages: async () => messages
    })

    expect(i18n.global.t('settings.common.searchEngineUrlPlaceholder')).toBe(
      'Ex: https://a.com/search?q={query}'
    )
    expect(
      i18n.global.t('settings.provider.dialog.disableAllModels.content', {
        name: 'Example'
      })
    ).toBe('Are you sure you want to disable all models for "Example"?')
  })

  it('loads only the resolved locale and fallback before creating i18n', async () => {
    const catalog: Record<string, RendererLocaleMessages> = {
      'zh-CN': createMessages('Chinese'),
      'fr-FR': createMessages('Francais')
    }
    const loadMessages = vi.fn(async (locale: string) => catalog[locale])

    const { i18n, languageState } = await createRendererI18n({
      getLanguageState: async () => ({
        requestedLanguage: 'fr-FR',
        locale: 'fr-FR',
        direction: 'auto'
      }),
      loadMessages
    })

    expect(loadMessages).toHaveBeenCalledTimes(2)
    expect(loadMessages).toHaveBeenCalledWith('zh-CN')
    expect(loadMessages).toHaveBeenCalledWith('fr-FR')
    expect(i18n.global.locale.value).toBe('fr-FR')
    expect([...i18n.global.availableLocales].sort()).toEqual(['fr-FR', 'zh-CN'])
    expect(languageState.locale).toBe('fr-FR')
  })

  it('falls back to the fallback locale when the requested locale fails to load', async () => {
    const onError = vi.fn()
    const loadMessages = vi.fn(async (locale: string) => {
      if (locale === FALLBACK_LOCALE) return createMessages('Fallback')
      throw new Error('missing locale chunk')
    })

    const { i18n, languageState } = await createRendererI18n({
      getLanguageState: async () => ({
        requestedLanguage: 'fa-IR',
        locale: 'fa-IR',
        direction: 'rtl'
      }),
      loadMessages,
      onError
    })

    expect(i18n.global.locale.value).toBe(FALLBACK_LOCALE)
    expect(i18n.global.getLocaleMessage(FALLBACK_LOCALE)).toEqual(createMessages('Fallback'))
    expect(languageState).toMatchObject({ locale: FALLBACK_LOCALE, direction: 'auto' })
    expect(onError).toHaveBeenCalledWith('Failed to load locale fa-IR:', expect.any(Error))
  })

  it('boots with the fallback when reading language state fails', async () => {
    const onError = vi.fn()
    const loadMessages = vi.fn(async () => createMessages('Fallback'))

    const { i18n, languageState } = await createRendererI18n({
      getLanguageState: async () => {
        throw new Error('bridge unavailable')
      },
      loadMessages,
      onError
    })

    expect(loadMessages).toHaveBeenCalledOnce()
    expect(loadMessages).toHaveBeenCalledWith(FALLBACK_LOCALE)
    expect(i18n.global.locale.value).toBe(FALLBACK_LOCALE)
    expect(languageState).toEqual({
      requestedLanguage: FALLBACK_LOCALE,
      locale: FALLBACK_LOCALE,
      direction: 'auto'
    })
    expect(onError).toHaveBeenCalledWith(
      'Failed to read the renderer language state:',
      expect.any(Error)
    )
  })
})
