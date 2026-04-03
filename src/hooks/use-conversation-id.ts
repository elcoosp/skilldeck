// src/hooks/use-conversation-id.ts
import { useMatch } from '@tanstack/react-router'

export function useConversationIdFromUrl(): string | null {
  const match = useMatch({ from: '/conversations/$conversationId', shouldThrow: false })
  return (match?.params as { conversationId?: string })?.conversationId ?? null
}
