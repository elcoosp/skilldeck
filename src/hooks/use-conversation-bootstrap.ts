// src/hooks/use-conversation-bootstrap.ts
import { useQuery } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'

export interface ConversationBootstrapData {
  messages: Awaited<ReturnType<typeof commands.listMessages>>['data']
  branches: Awaited<ReturnType<typeof commands.listBranches>>['data']
  draft: Awaited<ReturnType<typeof commands.getConversationDraft>>['data']
  queued: Awaited<ReturnType<typeof commands.listQueuedMessages>>['data']
}

export function useConversationBootstrap(conversationId: UUID | null) {
  return useQuery({
    queryKey: ['conversation-bootstrap', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const [messagesRes, branchesRes, draftRes, queuedRes] = await Promise.all([
        commands.listMessages(conversationId, null),
        commands.listBranches(conversationId),
        commands.getConversationDraft(conversationId),
        commands.listQueuedMessages(conversationId),
      ])
      return {
        messages: messagesRes.status === 'ok' ? messagesRes.data : [],
        branches: branchesRes.status === 'ok' ? branchesRes.data : [],
        draft: draftRes.status === 'ok' ? draftRes.data : null,
        queued: queuedRes.status === 'ok' ? queuedRes.data : [],
      } as ConversationBootstrapData
    },
    enabled: !!conversationId,
    staleTime: 5000,
  })
}
