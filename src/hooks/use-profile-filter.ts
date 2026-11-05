import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'

export function useProfileFilter() {
  const navigate = useNavigate()
  const { profileId } = Route.useSearch()

  const setProfileId = useCallback(
    (id: string | null) => {
      navigate({
        search: (prev) => ({ ...prev, profileId: id || undefined })
      })
    },
    [navigate]
  )

  return { profileId: profileId ?? null, setProfileId }
}
