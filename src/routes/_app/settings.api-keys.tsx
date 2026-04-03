import { createFileRoute } from '@tanstack/react-router'
import { ApiKeysTab } from '@/components/settings/api-keys-tab'

export const Route = createFileRoute('/_app/settings/api-keys')({
  component: ApiKeysTab
})
