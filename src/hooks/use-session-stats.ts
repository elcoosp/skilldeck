// src/hooks/use-session-stats.ts
/**
 * Real-time token usage per conversation.
 * Accumulates input/output tokens from AgentEvent::Done events.
 */

import { useEffect, useState } from 'react'
import { type AgentEvent, onAgentEvent } from '@/lib/events'
import type { UUID } from '@/lib/types'

export interface SessionStats {
  inputTokens: number
  outputTokens: number
}

export function useSessionStats(conversationId: UUID | null): SessionStats {
  const [stats, setStats] = useState<SessionStats>({
    inputTokens: 0,
    outputTokens: 0
  })

  useEffect(() => {
    if (!conversationId) {
      setStats({ inputTokens: 0, outputTokens: 0 })
      return
    }

    let unlisten: (() => void) | null = null

    const handleEvent = (event: AgentEvent) => {
      if (event.conversation_id === conversationId && event.type === 'done') {
        setStats((prev) => ({
          inputTokens: prev.inputTokens + (event.input_tokens ?? 0),
          outputTokens: prev.outputTokens + (event.output_tokens ?? 0)
        }))
      }
    }

    onAgentEvent(handleEvent).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
      setStats({ inputTokens: 0, outputTokens: 0 }) // reset on unmount or conversation change
    }
  }, [conversationId])

  return stats
}
