/**
 * Message data hooks.
 *
 * Combines persisted messages from the DB with the live streaming buffer so
 * the thread always shows the latest state without a full refetch mid-stream.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAchievements } from '@/hooks/use-achievements'
import type { MessageData, ContextItem } from '@/lib/bindings' // <-- added ContextItem
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
      // Send the new request struct
      const res = await commands.sendMessage({
        conversation_id: conversationId,
        content,
        context_items: contextItems
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

/**
 * Returns persisted messages merged with the current streaming bubble.
 *
 * The streaming bubble is a synthetic `assistant` message appended to the
 * list while the agent is running, replaced by the real persisted message
 * after the `done` event triggers a refetch.
 */
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
    created_at: new Date().toISOString()
  }

  return [...messages, streamBubble]
}
