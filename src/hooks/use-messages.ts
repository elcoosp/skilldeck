// src/hooks/use-messages.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAchievements } from '@/hooks/use-achievements'
import type { ContextItem, MessageData } from '@/lib/bindings'
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
      const res = await commands.listMessages(conversationId, branchId ?? null)
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
  const activeBranchId = useUIStore((s) => s.activeBranchId)

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
        branch_id: activeBranchId,
        context_items: contextItems ?? null
      })
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId, activeBranchId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })

      setTimeout(() => {
        const messages = queryClient.getQueryData<MessageData[]>([
          'messages',
          conversationId,
          activeBranchId
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
  const hasError = useUIStore(
    (s) => s.streamingError[conversationId ?? ''] ?? false
  )

  if (hasError) {
    return messages
  }

  const lastMessage = messages[messages.length - 1]
  const expectingResponse = lastMessage?.role === 'user'

  if (!isRunning && !expectingResponse) {
    return messages
  }

  const streamBubble: MessageData = {
    id: '__streaming__',
    conversation_id: conversationId!,
    role: 'assistant',
    content: streamingText,
    created_at: new Date().toISOString(),
    context_items: null,
    metadata: null,
    input_tokens: null,
    output_tokens: null,
    seen: false,
  }

  return [...messages, streamBubble]
}
