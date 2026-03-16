/**
 * Conversation data hooks — TanStack Query wrappers over invoke layer.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import { useUIStore } from '@/store/ui'
import type { UUID } from '@/lib/types'

export function useConversations(profileId?: UUID) {
  return useQuery({
    queryKey: ['conversations', profileId],
    queryFn: async () => {
      const res = await commands.listConversations(profileId ?? null, '50')
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 30_000
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)

  return useMutation({
    mutationFn: async ({ profileId, title }: { profileId: UUID; title?: string }) => {
      const res = await commands.createConversation(profileId, title ?? null)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (newId) => {
      // Invalidate and refetch conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setActiveConversation(newId)
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
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      // Clear active selection if we just deleted the active conversation.
      if (activeConversationId === deletedId) {
        setActiveConversation(null)
      }
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
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })
}
