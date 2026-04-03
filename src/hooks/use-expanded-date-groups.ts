import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback, useMemo } from 'react'

export function useExpandedDateGroups() {
  const navigate = useNavigate()
  const { expandedDateGroups } = Route.useSearch()

  const groupKeys = useMemo(() => {
    return expandedDateGroups ? expandedDateGroups.split(',').filter(Boolean) : []
  }, [expandedDateGroups])

  const toggleDateGroup = useCallback(
    (key: string) => {
      navigate({
        search: (prev) => {
          const current = prev.expandedDateGroups ? prev.expandedDateGroups.split(',') : []
          const next = current.includes(key)
            ? current.filter((k) => k !== key)
            : [...current, key]
          return { ...prev, expandedDateGroups: next.length ? next.join(',') : undefined }
        }
      })
    },
    [navigate]
  )

  return { expandedDateGroups: groupKeys, toggleDateGroup }
}
