import { createFileRoute } from '@tanstack/react-router'
import { PreferencesTab } from '@/components/settings/preferences-tab'

export const Route = createFileRoute('/settings/preferences')({
  component: PreferencesTab
})
