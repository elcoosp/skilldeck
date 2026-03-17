/**
 * Conversation data hooks — TanStack Query wrappers over invoke layer.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'
import { useUIStore } from '@/store/ui'

export function useConversations(profileId?: UUID) {
  return useQuery({
    queryKey: ['conversations', profileId],
    queryFn: async () => {
      const res = await commands.listConversations(
        profileId ?? null,
        //@ts-expect-error
        50
      )
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false, // changed from true to avoid excessive refetches
    refetchOnMount: true,
    retry: 2
  })
}

export function useCreateConversation(profileId?: UUID) {
  const queryClient = useQueryClient()
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)

  return useMutation({
    mutationFn: async ({ title }: { title?: string }) => {
      // FIXED: ensure profileId exists before calling the command
      if (!profileId) throw new Error('No profile selected')
      const res = await commands.createConversation(profileId, title ?? null)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: async (newId) => {
      // Invalidate the exact query key that matches useConversations
      queryClient.invalidateQueries({
        queryKey: ['conversations', profileId],
        exact: true
      })

      // Force a refetch and wait for it to complete
      await queryClient.refetchQueries({
        queryKey: ['conversations', profileId],
        exact: true
      })

      // Small delay to ensure everything is updated
      await new Promise((resolve) => setTimeout(resolve, 50))

      setActiveConversation(newId)

      toast.success('Conversation created')
    },
    onError: (error) => {
      toast.error(`Failed to create conversation: ${error}`)
    }
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)

  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.deleteConversation(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (_data, deletedId) => {
      // Invalidate all conversation queries since we don't know the profileId
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
        exact: false
      })

      // Clear active selection if we just deleted the active conversation
      if (activeConversationId === deletedId) {
        setActiveConversation(null)
      }

      toast.success('Conversation deleted')
    },
    onError: (error) => {
      toast.error(`Failed to delete conversation: ${error}`)
    }
  })
}

export function useRenameConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, title }: { id: UUID; title: string }) => {
      const res = await commands.renameConversation(id, title)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      // Invalidate all conversation queries since we don't know the profileId
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
        exact: false
      })
      toast.success('Conversation renamed')
    },
    onError: (error) => {
      toast.error(`Failed to rename conversation: ${error}`)
    }
  })
}
