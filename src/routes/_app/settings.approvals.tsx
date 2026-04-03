import { createFileRoute } from '@tanstack/react-router'
import { ApprovalsTab } from '@/components/settings/approvals-tab'

export const Route = createFileRoute('/_app/settings/approvals')({
  component: ApprovalsTab
})
