import { createFileRoute } from '@tanstack/react-router'
import { ProfilesTab } from '@/components/settings/profiles-tab'

export const Route = createFileRoute('/settings/profiles')({
  component: ProfilesTab
})
