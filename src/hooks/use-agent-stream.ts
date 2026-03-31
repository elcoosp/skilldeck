/**
 * useAgentStream — subscribe to Tauri agent-event channel for a given
 * conversation and drive streaming text + running state in the UI store.
 *
 * IMPORTANT: streamingMessage is NOT returned here. MessageThread reads it
 * directly from the store so that token updates don't re-render CenterPanel.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { MessageData, NodeDocument, MdNode } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import type { AgentEvent as LocalAgentEvent } from '@/lib/events'
import { onAgentEvent } from '@/lib/events'
import { useToolApprovalStore } from '@/store/tool-approvals'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { useUIPersistentStore } from '@/store/ui-state'

export function useAgentStream(conversationId: string | null) {
  const queryClient = useQueryClient()
  const appendStreamingText = useUIEphemeralStore((s) => s.appendStreamingText)
  const clearStreamingText = useUIEphemeralStore((s) => s.clearStreamingText)
  const setStreamingMessage = useUIEphemeralStore((s) => s.setStreamingMessage)
  const setAgentRunning = useUIEphemeralStore((s) => s.setAgentRunning)
  const setStreamingError = useUIEphemeralStore((s) => s.setStreamingError)
  const unlockStage = useUIPersistentStore((s) => s.unlockStage)
  const setUnlockStage = useUIPersistentStore((s) => s.setUnlockStage)

  const addPending = useToolApprovalStore((s) => s.addPending)
  const clearAllApprovals = useToolApprovalStore((s) => s.clearAll)

  // Close over conversationId via ref so deferred flushes target current convo
  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId

  const pendingBuffer = useRef('')
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  const listenerReady = useRef(false)
  const eventBuffer = useRef<LocalAgentEvent[]>([])
  const autoNameAttempted = useRef<Set<string>>(new Set())

  // ── Fix 1 & 2: stable_nodes reference stabilization + dedup ──────────
  const prevStableNodesRef = useRef<MdNode[]>([])
  const prevStableDocRef = useRef<NodeDocument | null>(null)

  const resetStreamingRefs = useCallback(() => {
    prevStableNodesRef.current = []
    prevStableDocRef.current = null
  }, [])

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(() => {
      const cid = conversationIdRef.current
      if (pendingBuffer.current && cid) {
        appendStreamingText(cid, pendingBuffer.current)
        pendingBuffer.current = ''
      }
      flushTimer.current = null
    }, 50)
  }, [appendStreamingText])

  const flushNow = useCallback(() => {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    const cid = conversationIdRef.current
    if (pendingBuffer.current && cid) {
      appendStreamingText(cid, pendingBuffer.current)
      pendingBuffer.current = ''
    }
  }, [appendStreamingText])

  useEffect(() => {
    if (!conversationId) return

    const processBufferedEvents = () => {
      while (eventBuffer.current.length > 0) {
        const event = eventBuffer.current.shift()
        if (event) processEvent(event)
      }
    }

    const autoNameConversation = async () => {
      if (autoNameAttempted.current.has(conversationId)) return
      autoNameAttempted.current.add(conversationId)

      try {
        const conversationQueries = queryClient.getQueriesData<
          Array<{ id: string; title: string | null }>
        >({ queryKey: ['conversations'] })
        const conversations = conversationQueries.flatMap(([, data]) => data ?? [])
        const currentConvo = conversations.find((c) => c.id === conversationId)

        if (!currentConvo || currentConvo.title) return

        const messages = queryClient.getQueryData<MessageData[]>([
          'messages',
          conversationId
        ])
        const firstUserMsg = messages?.find((m) => m.role === 'user')
        if (!firstUserMsg?.content) return

        const raw = firstUserMsg.content.trim().slice(0, 60)
        const title = raw.charAt(0).toUpperCase() + raw.slice(1)

        const res = await commands.renameConversation(conversationId, title)
        if (res.status === 'ok') {
          queryClient.invalidateQueries({ queryKey: ['conversations'], exact: false })
        }
      } catch (error) {
        console.error('Failed to auto-name conversation:', error)
      }
    }

    const processEvent = (event: LocalAgentEvent) => {
      switch (event.type) {
        case 'started':
          resetStreamingRefs()
          setStreamingError(conversationId, false)
          setAgentRunning(conversationId, true)
          setStreamingMessage(conversationId, null)
          break

        case 'token':
          if (event.delta) {
            pendingBuffer.current += event.delta
            scheduleFlush()
          }
          break

        case 'stream_update': {
          // The backend sends 'node_document'
          const doc: NodeDocument = (event as any).node_document
          if (!doc) break

          // ── Stabilize stable_nodes reference ──
          const incoming = doc.stable_nodes
          const prev = prevStableNodesRef.current
          const sameStable =
            incoming.length === prev.length &&
            incoming.every((n, i) => n.id === prev[i].id)

          const stableNodes = sameStable ? prev : incoming
          if (!sameStable) prevStableNodesRef.current = incoming

          // ── Skip if draft didn't actually change ──
          const prevDoc = prevStableDocRef.current
          const prevDraft = prevDoc?.draft_nodes ?? []
          const nextDraft = doc.draft_nodes
          let sameDraft = prevDraft.length === nextDraft.length
          if (sameDraft) {
            for (let i = 0; i < nextDraft.length; i++) {
              if (prevDraft[i].id !== nextDraft[i].id) { sameDraft = false; break }
              const pn = prevDraft[i] as Record<string, unknown>
              const nn = nextDraft[i] as Record<string, unknown>
              if (pn.html !== nn.html) { sameDraft = false; break }
            }
          }

          if (sameStable && sameDraft) break

          const stabilizedDoc: NodeDocument = {
            stable_nodes: stableNodes,
            draft_nodes: doc.draft_nodes,
            toc_items: doc.toc_items,
            artifact_specs: doc.artifact_specs,
          }
          prevStableDocRef.current = stabilizedDoc

          if (rafRef.current) cancelAnimationFrame(rafRef.current)
          rafRef.current = requestAnimationFrame(() => {
            setStreamingMessage(conversationId, stabilizedDoc)
            rafRef.current = null
          })
          break
        }

        case 'tool_approval_required':
          if (event.tool_call_id) {
            addPending(event.tool_call_id, {
              id: event.tool_call_id,
              name: event.tool_name ?? 'unknown',
              arguments: event.arguments ?? {},
            })
          }
          break

        case 'cancelled' as any: // type assertion to bypass strict check
          flushNow()
          resetStreamingRefs()
          setAgentRunning(conversationId, false)
          clearStreamingText(conversationId)
          setStreamingMessage(conversationId, null)
          clearAllApprovals()
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId], exact: false })
          break

        case 'done':
          flushNow()
          resetStreamingRefs()
          setAgentRunning(conversationId, false)
          clearStreamingText(conversationId)
          clearAllApprovals()
          queryClient.invalidateQueries({ queryKey: ['queued-messages', conversationId] })
          if (unlockStage === 0) setUnlockStage(1)
          break

        case 'error':
          flushNow()
          resetStreamingRefs()
          setAgentRunning(conversationId, false)
          setStreamingError(conversationId, true)
          clearStreamingText(conversationId)
          setStreamingMessage(conversationId, null)
          clearAllApprovals()
          toast.error(event.message || 'An error occurred while processing your message')
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId], exact: false })
          queryClient.invalidateQueries({ queryKey: ['conversations'], exact: false })
          break

        case 'persisted':
          resetStreamingRefs()
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId], exact: false })
          queryClient.invalidateQueries({ queryKey: ['conversations'], exact: false })
          setStreamingMessage(conversationId, null)
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
      if (flushTimer.current) {
        clearTimeout(flushTimer.current)
        flushTimer.current = null
      }
      pendingBuffer.current = ''
      listenerReady.current = false
      eventBuffer.current = []
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      unlisten?.()
    }
  }, [
    conversationId,
    queryClient,
    unlockStage,
    setUnlockStage,
    appendStreamingText,
    clearStreamingText,
    setStreamingMessage,
    setAgentRunning,
    setStreamingError,
    addPending,
    clearAllApprovals,
    resetStreamingRefs,
    scheduleFlush,
    flushNow,
  ])

  // ── Do NOT return streamingMessage ──
  // MessageThread reads it directly from the store so that token updates
  // don't re-render CenterPanel (this hook's caller).
  const streamingText = useUIEphemeralStore(
    (s) => s.streamingText[conversationId ?? ''] ?? ''
  )
  const isRunning = useUIEphemeralStore(
    (s) => s.agentRunning[conversationId ?? ''] ?? false
  )

  return { streamingText, isRunning }
}
