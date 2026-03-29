// src/App.tsx
/**
 * App root — wires React Query, applies persisted theme, mounts AppShell.
 * Shows the OnboardingWizard on first run.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import './App.css'
import { AppShell } from '@/components/layout/app-shell'
import { OnboardingWizard } from '@/components/overlays/onboarding-wizard'
import { GlobalSearchModal } from '@/components/search/global-search-modal'
import { SplashScreen } from '@/components/overlays/splash-screen'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useMcpEvents } from '@/hooks/use-mcp-events'
import { useSkillEvents } from '@/hooks/use-skill-events'
import { useSubagentEvents } from '@/hooks/use-subagent-events'
import { useSettingsStore } from '@/store/settings'
import type { SettingsTab } from '@/store/ui-overlays'
import { useUIOverlaysStore } from '@/store/ui-overlays'
import { useUIPersistentStore } from '@/store/ui-state'
import { useUILayoutStore } from '@/store/ui-layout'
import { loadLocale, locales } from '@/lib/i18n'
import { useAttachFilesListener } from './hooks/use-attach-files-listener'
import { commands } from '@/lib/bindings'

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
  useAttachFilesListener()
  return null
}

function AppContent() {
  const onboardingComplete = useUIPersistentStore((s) => s.onboardingComplete)
  const globalSearchOpen = useUIOverlaysStore((s) => s.globalSearchOpen)
  const setGlobalSearchOpen = useUIOverlaysStore((s) => s.setGlobalSearchOpen)

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
  const setSettingsOpen = useUIOverlaysStore((s) => s.setSettingsOpen)
  const setSettingsTab = useUIOverlaysStore((s) => s.setSettingsTab)
  const setRightTab = useUILayoutStore((s) => s.setRightTab)

  // Splash screen state
  const [showSplash, setShowSplash] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  // Load syntax theme CSS on mount
  useEffect(() => {
    commands.getSyntaxCss().then(css => {
      const style = document.getElementById('syntax-theme');
      if (style) {
        style.textContent = css.data;
      } else {
        const s = document.createElement('style');
        s.id = 'syntax-theme';
        s.textContent = css.data;
        document.head.appendChild(s);
      }
    }).catch(err => {
      console.error('Failed to load syntax theme CSS:', err);
    });
  }, []);

  // Start fade-out after 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true)
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  // Remove splash screen after fade-out completes
  const handleTransitionEnd = () => {
    if (fadeOut) setShowSplash(false)
  }

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
        {showSplash && (
          <div
            className={`fixed inset-0 z-50 transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'
              }`}
            onTransitionEnd={handleTransitionEnd}
          >
            <SplashScreen />
          </div>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
