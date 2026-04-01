import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'
import { useAchievements } from '@/hooks/use-achievements'
import type { ContextItem, MessageData } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'

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

export function useSendMessage(
  conversationId: UUID,
  branchId: UUID | null = null
) {
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
        branch_id: branchId, // <-- added
        context_items: contextItems ?? null
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

  const { streamingText, isRunning, hasError } = useUIEphemeralStore(
    useShallow((s) => ({
      streamingText: s.streamingText[conversationId ?? ''] ?? '',
      isRunning: s.agentRunning[conversationId ?? ''] ?? false,
      hasError: s.streamingError[conversationId ?? ''] ?? false
    }))
  )

  if (hasError) return messages

  const lastMessage = messages[messages.length - 1]
  const expectingResponse = lastMessage?.role === 'user'

  if (!isRunning && !expectingResponse) return messages

  // Add streaming bubble with all required MessageData properties
  const streamBubble: MessageData = {
    id: '__streaming__',
    conversation_id: conversationId!,
    role: 'assistant',
    content: streamingText,
    created_at: new Date().toISOString(),
    context_items: null,
    metadata: null,
    seen: false,
    input_tokens: null,
    output_tokens: null,
    node_document: null,
    status: 'pending' // <-- changed from null
  }

  return [...messages, streamBubble]
}
