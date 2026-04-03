import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback } from 'react'

export function useProfileFilter() {
  const navigate = useNavigate()
  const { profileId } = Route.useSearch()

  const setProfileId = useCallback(
    (id: string | null) => {
      navigate({
        search: (prev: any) => ({ ...prev, profileId: id || undefined })
      } as any)
    },
    [navigate]
  )

  return { profileId: profileId ?? null, setProfileId }
}
