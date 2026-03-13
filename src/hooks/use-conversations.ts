/**
 * Conversation data hooks — TanStack Query wrappers over invoke layer.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listConversations,
  createConversation,
  deleteConversation,
  renameConversation
} from '@/lib/invoke'
import { useUIStore } from '@/store/ui'
import type { UUID } from '@/lib/types'

export function useConversations(profileId?: UUID) {
  return useQuery({
    queryKey: ['conversations', profileId],
    queryFn: () => listConversations(profileId, 50),
    staleTime: 30_000
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)

  return useMutation({
    mutationFn: ({ profileId, title }: { profileId: UUID; title?: string }) =>
      createConversation(profileId, title),
    onSuccess: (newId) => {
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
    mutationFn: (id: UUID) => deleteConversation(id),
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
    mutationFn: ({ id, title }: { id: UUID; title: string }) =>
      renameConversation(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })
}
