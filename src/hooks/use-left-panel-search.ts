import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { Route } from '@/routes/__root'

export function useLeftPanelSearch() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { leftSearch } = search

  const setLeftSearch = useCallback(
    (value: string) => {
      navigate({
        search: (prev: ReturnType<typeof Route.useSearch>) => ({
          ...prev,
          leftSearch: value || undefined
        })
      } as never)
    },
    [navigate]
  )

  return { leftSearch: leftSearch ?? '', setLeftSearch }
}
