// src/routes/_app/$.tsx (or a custom NotFound component)

import { useRouter } from '@tanstack/react-router'
import { PremiumError } from '@/components/ui/premium-error'

export function NotFoundRoute() {
  const router = useRouter()
  return (
    <PremiumError
      code="404"
      title="Lost in the skills?"
      description="The page you're looking for isn't here. Maybe it was moved or never existed."
      action={{
        label: 'Go home',
        onClick: () => router.navigate({ to: '/' })
      }}
      secondaryAction={{
        label: 'Go back',
        onClick: () => router.history.back()
      }}
    />
  )
}
