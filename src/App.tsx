/**
 * App root — wires React Query, applies persisted theme, mounts AppShell.
 * Shows the OnboardingWizard on first run.
 */

import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './App.css'
import { AppShell } from '@/components/layout/app-shell'
import { OnboardingWizard } from '@/components/overlays/onboarding-wizard'
import { useSettingsStore } from '@/store/settings'
import { useUIStore } from '@/store/ui'
import { useMcpEvents } from '@/hooks/use-mcp-events'
import { useSubagentEvents } from '@/hooks/use-subagent-events'

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

/** Global Tauri event listeners that must run for the lifetime of the app. */
function GlobalEventListeners() {
  // Keep mcp-servers query fresh whenever MCP lifecycle events arrive.
  useMcpEvents()
  useSubagentEvents() // <-- new
  return null
}

function AppContent() {
  const onboardingComplete = useUIStore((s) => s.onboardingComplete)

  return (
    <>
      <GlobalEventListeners />
      <AppShell />
      {!onboardingComplete && <OnboardingWizard />}
    </>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <AppContent />
    </QueryClientProvider>
  )
}

export default App
