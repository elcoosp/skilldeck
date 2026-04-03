// src/hooks/use-scroll-to-message.ts
import { useMatch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export function useScrollToMessage() {
  const match = useMatch({ from: '/conversations/$conversationId', shouldThrow: false })
  const search = match?.search as { messageId?: string } | undefined
  const messageId = search?.messageId ?? null
  const [scrollId, setScrollId] = useState<string | null>(null)

  useEffect(() => {
    if (messageId) {
      setScrollId(messageId)
      const timer = setTimeout(() => setScrollId(null), 500)
      return () => clearTimeout(timer)
    }
  }, [messageId])

  return scrollId
}
