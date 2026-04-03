import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/__root'
import { useCallback, useMemo } from 'react'

export function useExpandedFolders() {
  const navigate = useNavigate()
  const { expandedFolders } = Route.useSearch()

  const folderIds = useMemo(() => {
    return expandedFolders ? expandedFolders.split(',').filter(Boolean) : []
  }, [expandedFolders])

  const toggleFolder = useCallback(
    (folderId: string) => {
      navigate({
        search: (prev) => {
          const current = prev.expandedFolders ? prev.expandedFolders.split(',') : []
          const next = current.includes(folderId)
            ? current.filter((id) => id !== folderId)
            : [...current, folderId]
          return { ...prev, expandedFolders: next.length ? next.join(',') : undefined }
        }
      })
    },
    [navigate]
  )

  return { expandedFolders: folderIds, toggleFolder }
}
