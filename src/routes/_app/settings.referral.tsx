import { createFileRoute } from '@tanstack/react-router'
import { ReferralTab } from '@/components/settings/referral-tab'

export const Route = createFileRoute('/_app/settings/referral')({
  component: ReferralTab
})
