import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands, WorkspaceData } from '@/lib/bindings'
import type { UUID } from '@/lib/types'

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await commands.listWorkspaces()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 30_000
  })
}

export function useOpenWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (path: string) => {
      const res = await commands.openWorkspace(path)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    }
  })
}

export function useCloseWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.closeWorkspace(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    }
  })
}
export function useUpdateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, avatar_style }: { id: UUID; avatar_style: string }) => {
      const res = await commands.updateWorkspace(id, avatar_style)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onMutate: async ({ id, avatar_style }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['workspaces'] })

      // Snapshot previous value
      const previousWorkspaces = queryClient.getQueryData<WorkspaceData[]>(['workspaces'])

      // Optimistically update the cache
      queryClient.setQueryData<WorkspaceData[]>(['workspaces'], (old) => {
        if (!old) return old
        return old.map((w) => (w.id === id ? { ...w, avatar_style } : w))
      })

      // Return context with snapshot for rollback
      return { previousWorkspaces }
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(['workspaces'], context?.previousWorkspaces)
    },
    onSettled: () => {
      // Refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    }
  })
}
