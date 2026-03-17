// src/hooks/use-queued-messages.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'
import type { ContextItem } from '@/lib/bindings'

export interface QueuedMessage {
  id: UUID
  conversation_id: UUID
  content: string
  position: number
  created_at: string
  updated_at: string
}

export function useQueuedMessages(conversationId: UUID | null) {
  return useQuery({
    queryKey: ['queued-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return []
      console.log('[useQueuedMessages] fetching for', conversationId)
      const res = await commands.listQueuedMessages(conversationId)
      if (res.status === 'error') {
        console.error('[useQueuedMessages] error:', res.error)
        throw new Error(res.error)
      }
      console.log('[useQueuedMessages] received:', res.data)
      return res.data as QueuedMessage[]
    },
    enabled: !!conversationId,
    staleTime: 0,
    refetchInterval: false,
  })
}

export function useAddQueuedMessage(conversationId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ content, contextItems }: { content: string; contextItems?: ContextItem[] }) => {
      const res = await commands.addQueuedMessage({
        conversation_id: conversationId,
        content,
        context_items: contextItems,
      })
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['queued-messages', conversationId] })
      setTimeout(() => {
        qc.refetchQueries({ queryKey: ['queued-messages', conversationId] })
      }, 50)
      toast.success('Message queued')
    },
    onError: (error) => {
      toast.error(`Failed to queue message: ${error.message}`)
    },
  })
}

export function useUpdateQueuedMessage(conversationId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, content }: { id: UUID; content: string }) => {
      const res = await commands.updateQueuedMessage(id, content)
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queued-messages', conversationId] })
    },
  })
}

export function useDeleteQueuedMessage(conversationId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: UUID) => {
      const res = await commands.deleteQueuedMessage(id)
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queued-messages', conversationId] })
    },
  })
}

export function useReorderQueuedMessages(conversationId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: UUID[]) => {
      const res = await commands.reorderQueuedMessages(conversationId, orderedIds)
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queued-messages', conversationId] })
    },
  })
}

export function useMergeQueuedMessages(conversationId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: UUID[]) => {
      const res = await commands.mergeQueuedMessages(ids)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queued-messages', conversationId] })
    },
  })
}
