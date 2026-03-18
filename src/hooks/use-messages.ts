// src/hooks/use-messages.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAchievements } from '@/hooks/use-achievements'
import type { MessageData, ContextItem } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'
import { useUIStore } from '@/store/ui'

export function useMessages(
  conversationId: UUID | null,
  branchId?: UUID | null
) {
  return useQuery({
    queryKey: ['messages', conversationId, branchId],
    queryFn: async () => {
      if (!conversationId) return []
      const res = await commands.listMessages(conversationId!, branchId ?? null)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!conversationId,
    staleTime: 10_000,
    placeholderData: (previousData) => previousData
  })
}

export function useSendMessage(conversationId: UUID) {
  const queryClient = useQueryClient()
  const { unlock } = useAchievements()

  return useMutation({
    mutationFn: async ({
      content,
      contextItems
    }: {
      content: string
      contextItems?: ContextItem[]
    }) => {
      const res = await commands.sendMessage({
        conversation_id: conversationId,
        content,
        context_items: contextItems ?? null // convert undefined to null
      })
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })

      setTimeout(() => {
        const messages = queryClient.getQueryData<MessageData[]>([
          'messages',
          conversationId
        ])
        if (messages) {
          const userMessageCount = messages.filter(
            (m) => m.role === 'user'
          ).length
          if (userMessageCount === 1) {
            unlock('firstMessage')
          }
          if (userMessageCount === 10) {
            unlock('tenthMessage')
          }
        }
      }, 100)
    }
  })
}

export function useMessagesWithStream(
  conversationId: UUID | null,
  branchId?: UUID | null
): MessageData[] {
  const { data: messages = [] } = useMessages(conversationId, branchId)
  const streamingText = useUIStore(
    (s) => s.streamingText[conversationId ?? ''] ?? ''
  )
  const isRunning = useUIStore(
    (s) => s.agentRunning[conversationId ?? ''] ?? false
  )

  if (!isRunning || !streamingText) return messages

  const streamBubble: MessageData = {
    id: '__streaming__',
    conversation_id: conversationId!,
    role: 'assistant',
    content: streamingText,
    created_at: new Date().toISOString(),
    context_items: null // add required field
  }

  return [...messages, streamBubble]
}
