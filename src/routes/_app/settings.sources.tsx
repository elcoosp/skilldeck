import { createFileRoute } from '@tanstack/react-router'
import { SkillSources } from '@/components/settings/skill-sources'

export const Route = createFileRoute('/_app/settings/sources')({
  component: SkillSources
})
