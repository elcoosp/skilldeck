/**
 * Message data hooks.
 *
 * Combines persisted messages from the DB with the live streaming buffer so
 * the thread always shows the latest state without a full refetch mid-stream.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listMessages, sendMessage } from '@/lib/invoke'
import { useUIStore } from '@/store/ui'
import { useAchievements } from '@/hooks/use-achievements'
import type { Message } from '@/lib/invoke'
import type { UUID } from '@/lib/types'

export function useMessages(
  conversationId: UUID | null,
  branchId?: UUID | null
) {
  return useQuery({
    queryKey: ['messages', conversationId, branchId],
    queryFn: () => listMessages(conversationId!, branchId ?? undefined),
    enabled: !!conversationId,
    staleTime: 0 // Always fresh after agent completes
  })
}

export function useSendMessage(conversationId: UUID) {
  const queryClient = useQueryClient()
  const { unlock } = useAchievements()

  return useMutation({
    mutationFn: (content: string) => sendMessage(conversationId, content),
    onSuccess: () => {
      // Agent loop events handle the streaming UX; refetch once done.
      // The `done` event in use-agent-stream triggers this via invalidation.
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })

      // Check for achievements after the message is sent and data refetched
      setTimeout(() => {
        const messages = queryClient.getQueryData<Message[]>(['messages', conversationId])
        if (messages) {
          // Count user messages
          const userMessageCount = messages.filter(m => m.role === 'user').length
          if (userMessageCount === 1) {
            unlock('firstMessage')
          }
          if (userMessageCount === 10) {
            unlock('tenthMessage')
          }
        }
      }, 100) // small delay to allow refetch
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
): Message[] {
  const { data: messages = [] } = useMessages(conversationId, branchId)
  const streamingText = useUIStore(
    (s) => s.streamingText[conversationId ?? ''] ?? ''
  )
  const isRunning = useUIStore(
    (s) => s.agentRunning[conversationId ?? ''] ?? false
  )

  if (!isRunning || !streamingText) return messages

  const streamBubble: Message = {
    id: '__streaming__',
    conversation_id: conversationId!,
    role: 'assistant',
    content: streamingText,
    created_at: new Date().toISOString()
  }

  return [...messages, streamBubble]
}
