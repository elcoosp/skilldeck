import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { Route } from '@/routes/__root'

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
