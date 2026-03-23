// src/hooks/use-session-stats.ts
/**
 * Real-time token usage per conversation.
 * Accumulates input/output tokens from AgentEvent::Done events.
 */

import { useEffect, useRef } from 'react'
import { onAgentEvent, AgentEvent } from '@/lib/events'
import type { UUID } from '@/lib/types'

export interface SessionStats {
  inputTokens: number
  outputTokens: number
}

export function useSessionStats(conversationId: UUID | null): SessionStats {
  const statsRef = useRef<SessionStats>({ inputTokens: 0, outputTokens: 0 })

  useEffect(() => {
    if (!conversationId) return

    let unlisten: (() => void) | null = null

    const handleEvent = (event: AgentEvent) => {
      if (event.conversation_id === conversationId && event.type === 'done') {
        statsRef.current.inputTokens += event.input_tokens ?? 0
        statsRef.current.outputTokens += event.output_tokens ?? 0
      }
    }

    onAgentEvent(handleEvent).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
      // Reset stats when conversation changes? We keep accumulating per session.
    }
  }, [conversationId])

  return statsRef.current
}
