import { createFileRoute } from '@tanstack/react-router'
import { LintConfig } from '@/components/settings/lint-config'

export const Route = createFileRoute('/_app/settings/lint')({
  component: LintConfig
})
