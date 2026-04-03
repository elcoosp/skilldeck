import { createFileRoute } from '@tanstack/react-router'
import { AppearanceTab } from '@/components/settings/appearance-tab'

export const Route = createFileRoute('/settings/appearance')({
  component: AppearanceTab
})
