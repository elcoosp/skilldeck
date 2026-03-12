import { i18n } from '@lingui/core'

export const locales = {
  en: 'English'
} as const

export type Locale = keyof typeof locales
export const defaultLocale: Locale = 'en'

// 1. Activate immediately with empty messages to prevent crashes
i18n.load(defaultLocale, {})
i18n.activate(defaultLocale)

// 2. Load compiled messages asynchronously
export async function loadLocale(locale: Locale) {
  try {
    const { messages } = await import(`../locales/${locale}/messages.js`)
    i18n.load(locale, messages)
    i18n.activate(locale)
  } catch (error) {
    console.warn(
      `Locale files for "${locale}" not found. Did you run 'pnpm i18n:compile'? ${error}`
    )
  }
}

// 3. Init function called in main.tsx
export function initI18n() {
  loadLocale(defaultLocale)
}
