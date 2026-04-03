import { createFileRoute } from '@tanstack/react-router'
import { GlobalEventListeners } from '@/components/global-event-listeners'
import { AppShell } from '@/components/layout/app-shell'
import { OnboardingWizard } from '@/components/overlays/onboarding-wizard'
import { useUIPersistentStore } from '@/store/ui-state'

export const Route = createFileRoute('/_app')({
  component: AppLayout
})

function AppLayout() {
  const onboardingComplete = useUIPersistentStore((s) => s.onboardingComplete)

  return (
    <>
      <GlobalEventListeners />
      <AppShell />
      {!onboardingComplete && <OnboardingWizard />}
    </>
  )
}
