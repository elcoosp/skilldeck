import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { GlobalEventListeners } from '@/components/global-event-listeners'
import { AppShell } from '@/components/layout/app-shell'
import { OnboardingWizard } from '@/components/overlays/onboarding-wizard'
import { commands } from '@/lib/bindings'
import { useUIPersistentStore } from '@/store/ui-state'

export const Route = createFileRoute('/_app')({
  component: AppLayout
})

function AppLayout() {
  const onboardingComplete = useUIPersistentStore((s) => s.onboardingComplete)
  const setOnboardingComplete = useUIPersistentStore(
    (s) => s.setOnboardingComplete
  )

  useEffect(() => {
    if (onboardingComplete) return
    let cancelled = false
    commands
      .isE2eTesting()
      .then((e2e) => {
        if (!cancelled && e2e) setOnboardingComplete(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [onboardingComplete, setOnboardingComplete])

  return (
    <>
      <GlobalEventListeners />
      <AppShell />
      {!onboardingComplete && <OnboardingWizard />}
    </>
  )
}
