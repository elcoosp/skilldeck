import { i18n } from '@lingui/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultLocale, initI18n, loadLocale, locales } from '@/lib/i18n'

vi.mock('@/locales/en/messages.js', () => ({
  messages: { hello: 'Hello' }
}))

const activateSpy = vi.spyOn(i18n, 'activate')

beforeEach(() => {
  activateSpy.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('i18n', () => {
  it('registers en as a locale and the default', () => {
    expect(locales).toHaveProperty('en')
    expect(defaultLocale).toBe('en')
  })

  it('loads and activates the default locale from compiled messages', async () => {
    await loadLocale('en')
    expect(activateSpy).toHaveBeenCalledWith('en')
  })

  it('initI18n triggers a default locale load', async () => {
    initI18n()
    await vi.waitFor(() => expect(activateSpy).toHaveBeenCalledWith('en'))
  })

  it('warns and leaves the active locale unchanged when messages are missing', async () => {
    const before = activateSpy.mock.calls.length
    await loadLocale('fr' as typeof defaultLocale)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Locale files for "fr" not found')
    )
    expect(activateSpy.mock.calls.length).toBe(before)
  })
})
