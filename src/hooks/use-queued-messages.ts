// src/hooks/use-queued-messages.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from '@/components/ui/toast'
import type { ContextItem } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import { onQueueEvent, type QueueEvent } from '@/lib/events'
import type { UUID } from '@/lib/types'

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
      const res = await commands.listQueuedMessages(conversationId)
      if (res.status === 'error') {
        console.error('[useQueuedMessages] error:', res.error)
        throw new Error(res.error)
      }
      return res.data as QueuedMessage[]
    },
    enabled: !!conversationId,
    staleTime: 0,
    refetchInterval: false
  })
}

export function useAddQueuedMessage(conversationId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      content,
      contextItems
    }: {
      content: string
      contextItems?: ContextItem[]
    }) => {
      const res = await commands.addQueuedMessage({
        conversation_id: conversationId,
        content,
        context_items: contextItems ?? null
      })
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (_id) => {
      qc.invalidateQueries({ queryKey: ['queued-messages', conversationId] })
      setTimeout(() => {
        qc.refetchQueries({ queryKey: ['queued-messages', conversationId] })
      }, 50)
      toast.success('Message queued')
    },
    onError: (error) => {
      toast.error(`Failed to queue message: ${error.message}`)
    }
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
    }
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
    }
  })
}

export function useReorderQueuedMessages(conversationId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: UUID[]) => {
      const res = await commands.reorderQueuedMessages(
        conversationId,
        orderedIds
      )
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queued-messages', conversationId] })
    }
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
    }
  })
}

// NEW: Hook to listen for queue events and invalidate queries
export function useQueueEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let unlisten: (() => void) | null = null

    const handleEvent = (event: QueueEvent) => {
      if (event.type === 'message_sent') {
        queryClient.invalidateQueries({
          queryKey: ['queued-messages', event.conversation_id]
        })
      }
    }

    onQueueEvent(handleEvent).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [queryClient])
}
