import { useQuery } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'
import type { MessageData, BranchInfo, HeadingItem } from '@/lib/bindings' // <-- import binding types
import type { QueuedMessage } from '@/hooks/use-queued-messages'

export interface ConversationBootstrapData {
  messages: MessageData[]
  branches: BranchInfo[]   // use binding type
  draft: [string, any[]] | null
  queued: QueuedMessage[]
  headings: HeadingItem[]   // use binding type
}

export function useConversationBootstrap(conversationId: UUID | null) {
  return useQuery({
    queryKey: ['conversation-bootstrap', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const res = await commands.getConversationBootstrap(conversationId)
      if (res.status === 'ok') return res.data as ConversationBootstrapData
      throw new Error(res.error)
    },
    enabled: !!conversationId,
    staleTime: 5000,
  })
}
