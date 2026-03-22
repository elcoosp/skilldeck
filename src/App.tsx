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
import { GlobalSearchModal } from '@/components/search/global-search-modal'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMcpEvents } from '@/hooks/use-mcp-events'
import { useSkillEvents } from '@/hooks/use-skill-events'
import { useSubagentEvents } from '@/hooks/use-subagent-events'
import { useSettingsStore } from '@/store/settings'
import type { SettingsTab } from '@/store/ui'
import { useUIStore } from '@/store/ui'
import { loadLocale, locales } from '@/lib/i18n'

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

function LanguageSync() {
  const language = useSettingsStore((s) => s.language)
  useEffect(() => {
    loadLocale(language as keyof typeof locales)
  }, [language])
  return null
}

/** Global Tauri event listeners that must run for the lifetime of the app. */
function GlobalEventListeners() {
  useMcpEvents()
  useSubagentEvents()
  useSkillEvents()
  return null
}

function AppContent() {
  const onboardingComplete = useUIStore((s) => s.onboardingComplete)
  const globalSearchOpen = useUIStore((s) => s.globalSearchOpen)
  const setGlobalSearchOpen = useUIStore((s) => s.setGlobalSearchOpen)

  // Global custom event listener for opening global search
  useEffect(() => {
    const handleOpenGlobalSearch = () => {
      setGlobalSearchOpen(true)
    }
    window.addEventListener('skilldeck:open-global-search', handleOpenGlobalSearch)
    return () =>
      window.removeEventListener('skilldeck:open-global-search', handleOpenGlobalSearch)
  }, [setGlobalSearchOpen])

  return (
    <>
      <GlobalEventListeners />
      <AppShell />
      {!onboardingComplete && <OnboardingWizard />}
      {globalSearchOpen && (
        <GlobalSearchModal
          open={globalSearchOpen}
          onClose={() => setGlobalSearchOpen(false)}
        />
      )}
    </>
  )
}

function App() {
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const setSettingsTab = useUIStore((s) => s.setSettingsTab)
  const setRightTab = useUIStore((s) => s.setRightTab)

  // Global custom event listener for opening settings with a specific tab
  useEffect(() => {
    const handleOpenSettings = (e: CustomEvent<{ tab: SettingsTab }>) => {
      setSettingsOpen(true)
      setSettingsTab(e.detail.tab)
    }
    window.addEventListener(
      'skilldeck:open-settings',
      handleOpenSettings as EventListener
    )
    return () =>
      window.removeEventListener(
        'skilldeck:open-settings',
        handleOpenSettings as EventListener
      )
  }, [setSettingsOpen, setSettingsTab])

  // Global custom event listener for switching the right panel tab
  useEffect(() => {
    const handleSetRightTab = (
      e: CustomEvent<{
        tab: 'session' | 'skills' | 'mcp' | 'workflow' | 'analytics'
      }>
    ) => {
      setRightTab(e.detail.tab)
    }
    window.addEventListener(
      'skilldeck:set-right-tab',
      handleSetRightTab as EventListener
    )
    return () =>
      window.removeEventListener(
        'skilldeck:set-right-tab',
        handleSetRightTab as EventListener
      )
  }, [setRightTab])

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeSync />
        <LanguageSync />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
