import { createFileRoute } from '@tanstack/react-router'
import { PlatformTab } from '@/components/settings/platform-tab'

export const Route = createFileRoute('/settings/platform')({
  component: PlatformTab
})
