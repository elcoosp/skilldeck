import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { useConversationStore } from '@/store/conversation'

export const conversationSearchSchema = z.object({
  messageId: z.string().optional(),
  branchId: z.string().optional(),
  conversationSearch: z.string().optional(),
  autoScroll: z.string().transform((v) => v !== 'false').optional()
})

export const Route = createFileRoute('/conversations/$conversationId')({
  validateSearch: conversationSearchSchema,
  component: ConversationLayout
})

function ConversationLayout() {
  const { conversationId } = Route.useParams()
  const { messageId } = Route.useSearch()
  const setActiveConversation = useConversationStore(
    (s) => s.setActiveConversation
  )
  const setScrollToMessageId = useConversationStore(
    (s) => s.setScrollToMessageId
  )

  useEffect(() => {
    setActiveConversation(conversationId)
    if (messageId) {
      setScrollToMessageId(messageId)
    }
  }, [conversationId, messageId, setActiveConversation, setScrollToMessageId])

  return null
}
