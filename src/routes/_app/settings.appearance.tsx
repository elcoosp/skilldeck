import { createFileRoute } from '@tanstack/react-router'
import { AppearanceTab } from '@/components/settings/appearance-tab'

export const Route = createFileRoute('/_app/settings/appearance')({
  component: AppearanceTab
})
