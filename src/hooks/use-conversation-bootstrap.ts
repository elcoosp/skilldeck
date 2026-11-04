import { useQuery } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'

export function useConversationBootstrap(conversationId: UUID | null) {
  return useQuery({
    queryKey: ['conversation-bootstrap', conversationId],
    queryFn: async () => {
      if (!conversationId) return null
      const res = await commands.getConversationBootstrap(conversationId)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!conversationId,
    staleTime: 5000
  })
}
