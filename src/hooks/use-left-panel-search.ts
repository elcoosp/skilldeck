import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback } from 'react'

export function useLeftPanelSearch() {
  const navigate = useNavigate()
  const { leftSearch } = Route.useSearch()

  const setLeftSearch = useCallback(
    (value: string) => {
      navigate({
        search: (prev: any) => ({ ...prev, leftSearch: value || undefined })
      } as any)
    },
    [navigate]
  )

  return { leftSearch: leftSearch ?? '', setLeftSearch }
}
