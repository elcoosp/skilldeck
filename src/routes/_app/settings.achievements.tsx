import { createFileRoute } from '@tanstack/react-router'
import { AchievementsTab } from '@/components/settings/achievements-tab'

export const Route = createFileRoute('/_app/settings/achievements')({
  component: AchievementsTab
})
