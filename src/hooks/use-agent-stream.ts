// src/hooks/use-agent-stream.ts
/**
 * useAgentStream — subscribe to Tauri agent-event channel for a given
 * conversation and drive streaming text + running state in the UI store.
 *
 * Implements the rAF-gated rendering loop required by ASR-PERF-001:
 *   Rust ring-buffer → 50 ms debounce → Tauri emit → this hook → rAF → render
 */

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { AgentEvent } from '@/lib/events'
import { onAgentEvent } from '@/lib/events'
import { useUIStore } from '@/store/ui'

export function useAgentStream(conversationId: string | null) {
  const queryClient = useQueryClient()
  const appendStreamingText = useUIStore((s) => s.appendStreamingText)
  const clearStreamingText = useUIStore((s) => s.clearStreamingText)
  const setAgentRunning = useUIStore((s) => s.setAgentRunning)
  const queuedMessage = useUIStore(
    (s) => s.queuedMessages[conversationId ?? '']
  )
  const clearQueuedMessage = useUIStore((s) => s.clearQueuedMessage)

  // Buffer deltas between rAF ticks to avoid per-token setState calls.
  const pendingBuffer = useRef('')
  const rafHandle = useRef<number>(0)
  // Track listener readiness to avoid race conditions
  const listenerReady = useRef(false)
  const eventBuffer = useRef<AgentEvent[]>([])

  useEffect(() => {
    if (!conversationId) return

    const flushBuffer = () => {
      if (pendingBuffer.current) {
        appendStreamingText(conversationId, pendingBuffer.current)
        pendingBuffer.current = ''
      }
      rafHandle.current = 0
    }

    const processBufferedEvents = () => {
      while (eventBuffer.current.length > 0) {
        const event = eventBuffer.current.shift()
        if (event) processEvent(event)
      }
    }

    const processEvent = (event: AgentEvent) => {
      switch (event.type) {
        case 'started':
          setAgentRunning(conversationId, true)
          // Invalidate messages query to show the persisted user message
          queryClient.invalidateQueries({
            queryKey: ['messages', conversationId],
            exact: false
          })
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
          // Show error toast and invalidate queries to show the user message
          toast.error(
            event.message || 'An error occurred while processing your message'
          )
          queryClient.invalidateQueries({
            queryKey: ['messages', conversationId],
            exact: false
          })
          queryClient.invalidateQueries({
            queryKey: ['conversations'],
            exact: false
          })
          break

        case 'persisted':
          // New messages have been saved to the database; refetch.
          queryClient.invalidateQueries({
            queryKey: ['messages', conversationId],
            exact: false
          })
          queryClient.invalidateQueries({
            queryKey: ['conversations'],
            exact: false
          })
          break
      }
    }

    const handleEvent = (event: AgentEvent) => {
      if (event.conversation_id !== conversationId) return

      // If listener isn't ready yet, buffer the event
      if (!listenerReady.current) {
        eventBuffer.current.push(event)
        return
      }

      processEvent(event)
    }

    // Set up listener synchronously
    let unlisten: (() => void) | null = null

    onAgentEvent(handleEvent).then((fn) => {
      unlisten = fn
      listenerReady.current = true
      // Process any events that arrived while listener was setting up
      processBufferedEvents()
    })

    return () => {
      if (rafHandle.current) cancelAnimationFrame(rafHandle.current)
      pendingBuffer.current = ''
      listenerReady.current = false
      eventBuffer.current = []
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
