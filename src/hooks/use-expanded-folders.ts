import { useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'

export function useExpandedFolders() {
  const navigate = useNavigate()
  const { expandedFolders } = Route.useSearch()

  const folderIds = useMemo(() => {
    return expandedFolders ? expandedFolders.split(',').filter(Boolean) : []
  }, [expandedFolders])

  const toggleFolder = useCallback(
    (folderId: string) => {
      const current = expandedFolders ? expandedFolders.split(',') : []
      const next = current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [...current, folderId]
      navigate({
        search: (prev) => ({
          ...prev,
          expandedFolders: next.length ? next.join(',') : undefined
        })
      })
    },
    [navigate, expandedFolders]
  )

  return { expandedFolders: folderIds, toggleFolder }
}
