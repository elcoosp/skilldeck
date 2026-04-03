import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback } from 'react'

export function useLeftPanelSearch() {
  const navigate = useNavigate()
  const { leftSearch } = Route.useSearch()

  const setLeftSearch = useCallback(
    (value: string) => {
      navigate({
        search: (prev) => ({ ...prev, leftSearch: value || undefined })
      })
    },
    [navigate]
  )

  return { leftSearch: leftSearch ?? '', setLeftSearch }
}
