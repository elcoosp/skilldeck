import { useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { Route } from '@/routes/__root'

export function useExpandedFolders() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { expandedFolders } = search

  const folderIds = useMemo(() => {
    return expandedFolders ? expandedFolders.split(',').filter(Boolean) : []
  }, [expandedFolders])

  const toggleFolder = useCallback(
    (folderId: string) => {
      const current = expandedFolders ? expandedFolders.split(',') : []
      const next: string[] = current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [...current, folderId]
      navigate({
        search: (prev: ReturnType<typeof Route.useSearch>) => ({
          ...prev,
          expandedFolders: next.length ? next.join(',') : undefined
        })
      } as never)
    },
    [navigate, expandedFolders]
  )

  return { expandedFolders: folderIds, toggleFolder }
}
