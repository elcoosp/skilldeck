import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { Route } from '@/routes/__root'

export function useProfileFilter() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { profileId } = search

  const setProfileId = useCallback(
    (id: string | null) => {
      navigate({
        search: (prev: ReturnType<typeof Route.useSearch>) => ({
          ...prev,
          profileId: id || undefined
        })
      } as never)
    },
    [navigate]
  )

  return { profileId: profileId ?? null, setProfileId }
}
