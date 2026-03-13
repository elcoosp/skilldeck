import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listWorkspaces, openWorkspace, closeWorkspace } from '@/lib/invoke'
import type { Workspace } from '@/lib/invoke'
import type { UUID } from '@/lib/types'

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: listWorkspaces,
    staleTime: 30_000
  })
}

export function useOpenWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path: string) => openWorkspace(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    }
  })
}

export function useCloseWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: UUID) => closeWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    }
  })
}
