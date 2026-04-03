import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

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
  // No side effects needed – all scroll handling is in CenterPanel via URL search.
  return null
}
