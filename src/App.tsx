// src/App.tsx
/**
 * App root — wires React Query, applies persisted theme, mounts AppShell.
 * Shows the OnboardingWizard on first run.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import './App.css'
import { AppShell } from '@/components/layout/app-shell'
import { OnboardingWizard } from '@/components/overlays/onboarding-wizard'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMcpEvents } from '@/hooks/use-mcp-events'
import { useSubagentEvents } from '@/hooks/use-subagent-events'
import { useSkillEvents } from '@/hooks/use-skill-events' // <-- new
import { useSettingsStore } from '@/store/settings'
import { useUIStore } from '@/store/ui'

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
  useMcpEvents()
  useSubagentEvents()
  useSkillEvents() // <-- new
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
      <TooltipProvider>
        <ThemeSync />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
