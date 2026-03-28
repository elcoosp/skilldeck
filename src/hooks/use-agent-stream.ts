// src/hooks/use-agent-stream.ts
/**
 * useAgentStream — subscribe to Tauri agent-event channel for a given
 * conversation and drive streaming text + running state in the UI store.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { MessageData } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import type { AgentEvent as LocalAgentEvent } from '@/lib/events'
import { onAgentEvent } from '@/lib/events'
import { useToolApprovalStore } from '@/store/tool-approvals'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { useUIPersistentStore } from '@/store/ui-state'
import type { HtmlMessage } from '@/components/html-renderer/html-renderer'

export function useAgentStream(conversationId: string | null) {
  const queryClient = useQueryClient()
  const appendStreamingText = useUIEphemeralStore((s) => s.appendStreamingText)
  const clearStreamingText = useUIEphemeralStore((s) => s.clearStreamingText)
  const setStreamingMessage = useUIEphemeralStore((s) => s.setStreamingMessage)
  const setAgentRunning = useUIEphemeralStore((s) => s.setAgentRunning)
  const setStreamingError = useUIEphemeralStore((s) => s.setStreamingError)
  const unlockStage = useUIPersistentStore((s) => s.unlockStage)
  const setUnlockStage = useUIPersistentStore((s) => s.setUnlockStage)

  // Tool approval store actions
  const addPending = useToolApprovalStore((s) => s.addPending)
  const clearAllApprovals = useToolApprovalStore((s) => s.clearAll)

  // Buffer for accumulating tokens between flushes
  const pendingBuffer = useRef('')
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFlushing = useRef(false)

  // Track listener readiness to avoid race conditions
  const listenerReady = useRef(false)
  const eventBuffer = useRef<LocalAgentEvent[]>([])
  // Track auto-name attempts per conversation to prevent duplicates
  const autoNameAttempted = useRef<Set<string>>(new Set())

  // Schedule a flush of the pending buffer after a short debounce.
  const scheduleFlush = () => {
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(() => {
      if (pendingBuffer.current) {
        // Append the accumulated buffer to the store.
        appendStreamingText(conversationId!, pendingBuffer.current)
        pendingBuffer.current = ''
      }
      flushTimer.current = null
    }, 50) // 50ms debounce – imperceptible to the user
  }

  // Immediately flush any pending buffer (used on cancellation/done).
  const flushNow = () => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    if (pendingBuffer.current) {
      appendStreamingText(conversationId!, pendingBuffer.current)
      pendingBuffer.current = ''
    }
  }

  useEffect(() => {
    if (!conversationId) return

    const processBufferedEvents = () => {
      while (eventBuffer.current.length > 0) {
        const event = eventBuffer.current.shift()
        if (event) processEvent(event)
      }
    }

    /**
     * Auto-name the conversation from the first user message.
     * Triggered on 'persisted' event when conversation has no title.
     */
    const autoNameConversation = async () => {
      // Prevent duplicate attempts
      if (autoNameAttempted.current.has(conversationId)) {
        return
      }
      autoNameAttempted.current.add(conversationId)

      try {
        // Get conversations from cache – use getQueriesData to match all profile keys
        const conversationQueries = queryClient.getQueriesData<
          Array<{ id: string; title: string | null }>
        >({
          queryKey: ['conversations']
        })
        const conversations = conversationQueries.flatMap(
          ([, data]) => data ?? []
        )
        const currentConvo = conversations.find((c) => c.id === conversationId)

        // Only auto-name if no title exists
        if (!currentConvo || currentConvo.title) {
          return
        }

        // Get first user message from messages cache
        const messages = queryClient.getQueryData<MessageData[]>([
          'messages',
          conversationId
        ])

        const firstUserMsg = messages?.find((m) => m.role === 'user')

        if (!firstUserMsg?.content) {
          return
        }

        // Generate title: trim to 60 chars, capitalize first letter
        const raw = firstUserMsg.content.trim().slice(0, 60)
        const title = raw.charAt(0).toUpperCase() + raw.slice(1)

        // Call rename command
        const res = await commands.renameConversation(conversationId, title)
        if (res.status === 'ok') {
          queryClient.invalidateQueries({
            queryKey: ['conversations'],
            exact: false
          })
        }
      } catch (error) {
        console.error('Failed to auto-name conversation:', error)
      }
    }

    const processEvent = (event: LocalAgentEvent) => {
      switch (event.type) {
        case 'started':
          setStreamingError(conversationId, false) // clear any previous error
          setAgentRunning(conversationId, true)
          queryClient.invalidateQueries({
            queryKey: ['messages', conversationId],
            exact: false
          })
          // Clear any old streaming message when a new agent starts
          setStreamingMessage(conversationId, null)
          break

        case 'token':
          if (event.delta) {
            pendingBuffer.current += event.delta
            scheduleFlush()
          }
          break

        case 'stream_update':
          // New event type for HTML streaming
          if (event.stable_html !== undefined) {
            const msg: HtmlMessage = {
              stableHtml: event.stable_html,
              draftHtml: event.draft_html ?? null,
              slotCount: event.slot_count ?? 0,
            }
            setStreamingMessage(conversationId, msg)
          }
          break

        case 'tool_approval_required':
          addPending(event.tool_call_id, {
            name: event.tool_name,
            arguments: event.arguments,
          })
          break

        case 'cancelled':
          flushNow() // flush any pending buffer before clearing
          setAgentRunning(conversationId, false)
          clearStreamingText(conversationId)
          setStreamingMessage(conversationId, null)
          clearAllApprovals()
          queryClient.invalidateQueries({
            queryKey: ['messages', conversationId],
            exact: false
          })
          break

        case 'done':
          flushNow() // flush any remaining buffer
          setAgentRunning(conversationId, false)
          clearStreamingText(conversationId)
          // Do NOT clear streamingMessage here; it will be cleared on 'persisted'
          clearAllApprovals()
          queryClient.invalidateQueries({
            queryKey: ['queued-messages', conversationId]
          })

          // ── Progressive unlock: after first message, unlock skills ──
          if (unlockStage === 0) {
            setUnlockStage(1)
          }
          break

        case 'error':
          flushNow() // discard buffer on error
          setAgentRunning(conversationId, false)
          setStreamingError(conversationId, true) // record error
          clearStreamingText(conversationId)
          setStreamingMessage(conversationId, null)
          clearAllApprovals()
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
          queryClient.invalidateQueries({
            queryKey: ['messages', conversationId],
            exact: false
          })
          queryClient.invalidateQueries({
            queryKey: ['conversations'],
            exact: false
          })
          // Clear streaming message only after the query will resolve with stable_html
          setStreamingMessage(conversationId, null)
          // Auto-name: rename if conversation has no title
          autoNameConversation()
          break
      }
    }

    const handleEvent = (event: LocalAgentEvent) => {
      if (event.conversation_id !== conversationId) return

      if (!listenerReady.current) {
        eventBuffer.current.push(event)
        return
      }

      processEvent(event)
    }

    let unlisten: (() => void) | null = null

    onAgentEvent(handleEvent).then((fn) => {
      unlisten = fn
      listenerReady.current = true
      processBufferedEvents()
    })

    return () => {
      // Clean up timers and buffers
      if (flushTimer.current) {
        clearTimeout(flushTimer.current)
        flushTimer.current = null
      }
      pendingBuffer.current = ''
      listenerReady.current = false
      eventBuffer.current = []
      unlisten?.()
    }
  }, [
    conversationId,
    appendStreamingText,
    clearStreamingText,
    setStreamingMessage,
    setAgentRunning,
    setStreamingError,
    queryClient,
    unlockStage,
    setUnlockStage,
    addPending,
    clearAllApprovals,
  ])

  const streamingText = useUIEphemeralStore(
    (s) => s.streamingText[conversationId ?? ''] ?? ''
  )
  const streamingMessage = useUIEphemeralStore(
    (s) => s.streamingMessages[conversationId ?? ''] ?? null
  )
  const isRunning = useUIEphemeralStore(
    (s) => s.agentRunning[conversationId ?? ''] ?? false
  )

  return { streamingText, streamingMessage, isRunning }
}
