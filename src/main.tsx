import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { loadLocale, type locales } from '@/lib/i18n'
import { useSettingsStore } from '@/store/settings'
import { router } from './router'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

function ThemeSync() {
  const theme = useSettingsStore((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme
    root.classList.toggle('dark', resolved === 'dark')
  }, [theme])
  return null
}

function FontSizeSync() {
  const fontSize = useSettingsStore((s) => s.uiFontSize)
  useEffect(() => {
    const root = document.documentElement
    const sizeMap = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' } as const
    root.classList.remove('text-sm', 'text-base', 'text-lg')
    root.classList.add(sizeMap[fontSize])
  }, [fontSize])
  return null
}

function LanguageSync() {
  const language = useSettingsStore((s) => s.language)
  useEffect(() => {
    loadLocale(language as keyof typeof locales)
  }, [language])
  return null
}

function handleDeepLinkUrls(urls: string[]) {
  for (const url of urls) {
    try {
      const parsed = new URL(url)
      const pathWithSearch = parsed.pathname + parsed.search
      if (pathWithSearch && pathWithSearch !== '/') {
        router.navigate({ to: pathWithSearch })
        return
      }
    } catch {
      // malformed URL, skip
    }
  }
}

// Handle initial deep link (app started from URL)
getCurrent().then((urls) => {
  if (urls && urls.length > 0) handleDeepLinkUrls(urls)
})

// Listen for future deep links while app is running
onOpenUrl((urls) => {
  handleDeepLinkUrls(urls)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeSync />
          <FontSizeSync />
          <LanguageSync />
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  </React.StrictMode>
)
