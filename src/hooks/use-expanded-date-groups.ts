import { useCallback, useMemo } from 'react'
import { Route } from '@/routes/__root'

export function useExpandedDateGroups() {
  const navigate = Route.useNavigate()
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
        search: (prev) => ({
          ...prev,
          expandedDateGroups: next.length ? next.join(',') : undefined
        })
      })
    },
    [navigate, expandedDateGroups]
  )

  return { expandedDateGroups: groupKeys, toggleDateGroup }
}
