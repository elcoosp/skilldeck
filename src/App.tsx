/**
 * App root — wires React Query, applies persisted theme, mounts AppShell.
 *
 * Intentionally thin: all layout and logic lives in AppShell and below.
 */

import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './App.css'
import { AppShell } from '@/components/layout/app-shell'
import { useSettingsStore } from '@/store/settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <AppShell />
    </QueryClientProvider>
  )
}

export default App
