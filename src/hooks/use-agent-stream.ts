// File: src/hooks/use-agent-stream.ts
/**
 * useAgentStream — subscribe to Tauri agent-event channel for a given
 * conversation and drive streaming text + running state in the UI store.
 *
 * Implements the rAF-gated rendering loop required by ASR-PERF-001:
 *   Rust ring-buffer → 50 ms debounce → Tauri emit → this hook → rAF → render
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onAgentEvent } from '@/lib/events'
import { useUIStore } from '@/store/ui'
import type { AgentEvent } from '@/lib/events'

export function useAgentStream(conversationId: string | null) {
  const queryClient = useQueryClient()
  const appendStreamingText = useUIStore((s) => s.appendStreamingText)
  const clearStreamingText = useUIStore((s) => s.clearStreamingText)
  const setAgentRunning = useUIStore((s) => s.setAgentRunning)
  const queuedMessage = useUIStore((s) => s.queuedMessages[conversationId ?? ''])
  const clearQueuedMessage = useUIStore((s) => s.clearQueuedMessage)

  // Buffer deltas between rAF ticks to avoid per-token setState calls.
  const pendingBuffer = useRef('')
  const rafHandle = useRef<number>(0)

  useEffect(() => {
    if (!conversationId) return

    const flushBuffer = () => {
      if (pendingBuffer.current) {
        appendStreamingText(conversationId, pendingBuffer.current)
        pendingBuffer.current = ''
      }
      rafHandle.current = 0
    }

    const handleEvent = (event: AgentEvent) => {
      if (event.conversation_id !== conversationId) return

      switch (event.type) {
        case 'started':
          setAgentRunning(conversationId, true)
          break

        case 'token':
          if (event.delta) {
            pendingBuffer.current += event.delta
            // Schedule a single rAF flush — coalesces multiple tokens per frame.
            if (!rafHandle.current) {
              rafHandle.current = requestAnimationFrame(flushBuffer)
            }
          }
          break

        case 'done':
          // Flush any remaining buffered tokens before clearing.
          if (pendingBuffer.current) {
            appendStreamingText(conversationId, pendingBuffer.current)
            pendingBuffer.current = ''
          }
          setAgentRunning(conversationId, false)
          clearStreamingText(conversationId)

          // If there's a queued message, send it now
          if (queuedMessage) {
            // We need access to the send mutation – we'll emit an event that
            // MessageInput listens to, or we can use a callback prop.
            // For simplicity, we'll dispatch a custom DOM event that MessageInput can catch.
            window.dispatchEvent(
              new CustomEvent('skilldeck:send-queued-message', {
                detail: { conversationId, content: queuedMessage }
              })
            )
            clearQueuedMessage(conversationId)
          }
          break

        case 'error':
          pendingBuffer.current = ''
          setAgentRunning(conversationId, false)
          clearStreamingText(conversationId)
          break

        case 'persisted':
          // New messages have been saved to the database; refetch.
          queryClient.invalidateQueries({
            queryKey: ['messages', conversationId]
          })
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
          break
      }
    }

    let unlisten: (() => void) | null = null
    onAgentEvent(handleEvent).then((fn) => {
      unlisten = fn
    })

    return () => {
      if (rafHandle.current) cancelAnimationFrame(rafHandle.current)
      pendingBuffer.current = ''
      unlisten?.()
    }
  }, [
    conversationId,
    appendStreamingText,
    clearStreamingText,
    setAgentRunning,
    queryClient,
    queuedMessage,
    clearQueuedMessage
  ])

  const streamingText = useUIStore(
    (s) => s.streamingText[conversationId ?? ''] ?? ''
  )
  const isRunning = useUIStore(
    (s) => s.agentRunning[conversationId ?? ''] ?? false
  )

  return { streamingText, isRunning }
}
