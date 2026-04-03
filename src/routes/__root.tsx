import { Outlet, createRootRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { HotkeysProvider } from 'react-hotkeys-hook'
import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { loadLocale, type locales } from '@/lib/i18n'
import { useSettingsStore } from '@/store/settings'
import { SplashScreen } from '@/components/overlays/splash-screen'
import { commands } from '@/lib/bindings'
import { z } from 'zod'
import { GlobalEventListeners } from '@/components/global-event-listeners'
import { AppShell } from '@/components/layout/app-shell'
import { OnboardingWizard } from '@/components/overlays/onboarding-wizard'
import { useUIPersistentStore } from '@/store/ui-state'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

export const rootSearchSchema = z.object({
  leftSearch: z.string().optional(),
  profileId: z.string().optional(),
  expandedFolders: z.string().optional(),
  expandedDateGroups: z.string().optional(),
  onboard: z.enum(['true']).optional()
})

export type RootSearch = z.infer<typeof rootSearchSchema>

export const Route = createRootRoute({
  validateSearch: rootSearchSchema,
  component: RootComponent,
  notFoundComponent: NotFound
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

function RootProviders({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    commands
      .getSyntaxCss()
      .then((res) => {
        if (res.status === 'error') {
          console.error('Failed to load syntax theme CSS:', res.error)
          return
        }
        const css = res.data
        const style = document.getElementById('syntax-theme')
        if (style) {
          style.textContent = css
        } else {
          const s = document.createElement('style')
          s.id = 'syntax-theme'
          s.textContent = css
          document.head.appendChild(s)
        }
      })
      .catch((err) => {
        console.error('Failed to load syntax theme CSS:', err)
      })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 2500)
    return () => clearTimeout(timer)
  }, [])

  const handleTransitionEnd = () => {
    if (fadeOut) setShowSplash(false)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeSync />
        <LanguageSync />
        {children}
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

function RootComponent() {
  const onboardingComplete = useUIPersistentStore((s) => s.onboardingComplete)

  return (
    <HotkeysProvider initiallyActiveScopes={['*']}>
      <RootProviders>
        <GlobalEventListeners />
        <AppShell />
        <Outlet />
        {!onboardingComplete && <OnboardingWizard />}
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </RootProviders>
    </HotkeysProvider>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
    </div>
  )
}
