import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { Route } from '@/routes/__root'

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
