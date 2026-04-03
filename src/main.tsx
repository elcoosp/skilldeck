import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { router } from './router'

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
      <RouterProvider router={router} />
    </I18nProvider>
  </React.StrictMode>
)
