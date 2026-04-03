import { createFileRoute } from '@tanstack/react-router'
import { PreferencesTab } from '@/components/settings/preferences-tab'

export const Route = createFileRoute('/_app/settings/preferences')({
  component: PreferencesTab
})
