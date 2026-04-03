import { useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { Route } from '@/routes/__root'

export function useExpandedDateGroups() {
  const navigate = useNavigate()
  const { expandedDateGroups } = Route.useSearch()

  const groupKeys = useMemo(() => {
    return expandedDateGroups
      ? expandedDateGroups.split(',').filter(Boolean)
      : []
  }, [expandedDateGroups])

  const toggleDateGroup = useCallback(
    (key: string) => {
      const current = expandedDateGroups ? expandedDateGroups.split(',') : []
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key]
      navigate({
        search: (prev: any) => ({
          ...prev,
          expandedDateGroups: next.length ? next.join(',') : undefined
        })
      } as any)
    },
    [navigate, expandedDateGroups]
  )

  return { expandedDateGroups: groupKeys, toggleDateGroup }
}
