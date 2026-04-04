'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'

type SupportedLocale = 'en'

// Map of locale to lazy-loaded catalog
const CATALOG_IMPORTS: Record<SupportedLocale, () => Promise<{ messages: Record<string, string> }>> = {
  en: () => import('@/locales/en/messages'),
}

export function LinguiClientProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<SupportedLocale>('en')

  const loadAndActivate = useCallback(async (loc: SupportedLocale) => {
    try {
      const { messages } = await CATALOG_IMPORTS[loc]()
      i18n.load(loc, messages)
      i18n.activate(loc)
      setLocale(loc)
    } catch (err) {
      console.warn(`Failed to load locale "${loc}":`, err)
    }
  }, [])

  useEffect(() => {
    loadAndActivate('en')
  }, [loadAndActivate])

  if (!locale) {
    return null // Prevent flash of untranslated content
  }

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
