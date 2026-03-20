import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import * as React from 'react'
import type { MessageData } from '@/lib/bindings'
import { MessageBubble } from './message-bubble'

export interface MessageThreadHandle {
  scrollToMessage: (index: number) => void
  scrollToIndex: (index: number, options?: { behavior?: 'auto' | 'smooth' }) => void
  getScrollPosition: () => number
  scrollToPosition: (position: number) => void
  getTotalHeight: () => number
  getClientHeight: () => number
}

interface MessageThreadProps {
  messages: MessageData[]
  streamingMessageId?: string
  isLoading?: boolean
  searchQuery?: string
  onVisibleUserIndexChange?: (index: number) => void
  highlightedMessageId?: string | null
  initialScrollOffset?: number
}

export const MessageThread = React.forwardRef<MessageThreadHandle, MessageThreadProps>(
  (
    {
      messages,
      streamingMessageId,
      isLoading,
      searchQuery = '',
      onVisibleUserIndexChange,
      highlightedMessageId,
      initialScrollOffset,
    },
    ref
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    const filteredMessages = React.useMemo(() => {
      if (!searchQuery.trim()) return messages
      const q = searchQuery.toLowerCase()
      return messages.filter(m => m.content.toLowerCase().includes(q))
    }, [messages, searchQuery])

    const filteredMessagesRef = React.useRef(filteredMessages)
    filteredMessagesRef.current = filteredMessages

    // ── Virtualizer ────────────────────────────────────────────────────────
    const virtualizer = useVirtualizer({
      count: filteredMessages.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => 120,
      overscan: 5,
      measureElement: el => el.getBoundingClientRect().height,
    })

    const virtualizerRef = React.useRef(virtualizer)
    virtualizerRef.current = virtualizer

    // ── Restore scroll offset on mount ─────────────────────────────────────
    // We can't just set scrollTop once — the virtualizer starts with estimated heights
    // so the DOM scrollHeight is too small to accommodate the saved offset.
    // Instead we keep re-applying every time getTotalSize() grows (rows get measured)
    // until the DOM can actually hold the target offset.
    const targetOffsetRef = React.useRef<number | undefined>(
      initialScrollOffset !== undefined && initialScrollOffset > 0 ? initialScrollOffset : undefined
    )

    React.useEffect(() => {
      if (targetOffsetRef.current === undefined) return
      const target = targetOffsetRef.current

      const tryRestore = () => {
        const el = scrollRef.current
        if (!el) return
        const maxScrollable = el.scrollHeight - el.clientHeight
        if (maxScrollable >= target) {
          el.scrollTop = target
          // If we successfully set it, stop trying
          if (el.scrollTop >= target - 5) {
            targetOffsetRef.current = undefined
          }
        }
      }

      // Try immediately
      tryRestore()
      // Poll via rAF until target is reached or 3s timeout
      let rafId: number
      let start = Date.now()
      const poll = () => {
        if (targetOffsetRef.current === undefined) return // done
        if (Date.now() - start > 3000) return // give up
        tryRestore()
        rafId = requestAnimationFrame(poll)
      }
      rafId = requestAnimationFrame(poll)

      return () => cancelAnimationFrame(rafId)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // New conversation (no saved offset): scroll to bottom once messages load
    const sentToBottomRef = React.useRef(false)
    React.useEffect(() => {
      if (sentToBottomRef.current) return
      if (initialScrollOffset !== undefined) { sentToBottomRef.current = true; return }
      if (filteredMessages.length === 0) return
      sentToBottomRef.current = true
      virtualizerRef.current.scrollToIndex(filteredMessages.length - 1, { align: 'end', behavior: 'auto' })
    }, [filteredMessages.length, initialScrollOffset])

    // ── Search ─────────────────────────────────────────────────────────────
    React.useLayoutEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }, [searchQuery])

    React.useEffect(() => {
      virtualizerRef.current.measure()
    }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Auto-scroll during streaming ───────────────────────────────────────
    const prevCountRef = React.useRef(filteredMessages.length)
    React.useEffect(() => {
      const prev = prevCountRef.current
      prevCountRef.current = filteredMessages.length
      if (streamingMessageId && filteredMessages.length > prev && !searchQuery) {
        virtualizerRef.current.scrollToIndex(filteredMessages.length - 1, { behavior: 'smooth' })
      }
    }, [filteredMessages.length, streamingMessageId, searchQuery])

    // ── Imperative handle ──────────────────────────────────────────────────
    const isProgrammaticScroll = React.useRef(false)
    const programmaticScrollTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useImperativeHandle(ref, () => ({
      scrollToMessage: (index: number) => {
        if (programmaticScrollTimer.current) clearTimeout(programmaticScrollTimer.current)
        isProgrammaticScroll.current = true
        callbackRef.current?.(index)
        virtualizerRef.current.scrollToIndex(index, { behavior: 'smooth', align: 'start' })
        programmaticScrollTimer.current = setTimeout(() => {
          isProgrammaticScroll.current = false
          programmaticScrollTimer.current = null
        }, 600)
      },
      scrollToIndex: (index, options) => virtualizerRef.current.scrollToIndex(index, options),
      getScrollPosition: () => scrollRef.current?.scrollTop ?? 0,
      scrollToPosition: (pos: number) => { if (scrollRef.current) scrollRef.current.scrollTop = pos },
      getTotalHeight: () => virtualizerRef.current.getTotalSize(),
      getClientHeight: () => scrollRef.current?.clientHeight ?? 0,
    }), [])

    // ── Visible user-message tracking ──────────────────────────────────────
    const callbackRef = React.useRef(onVisibleUserIndexChange)
    React.useLayoutEffect(() => { callbackRef.current = onVisibleUserIndexChange })

    React.useEffect(() => {
      const el = scrollRef.current
      if (!el || !onVisibleUserIndexChange) return

      const userIndices = filteredMessages
        .map((m, i) => (m.role === 'user' ? i : -1))
        .filter(i => i !== -1)
      if (userIndices.length === 0) return

      const report = () => {
        if (isProgrammaticScroll.current) return
        const items = virtualizerRef.current.getVirtualItems()
        if (items.length === 0) return
        const { scrollTop, scrollHeight, clientHeight } = el
        const maxScroll = scrollHeight - clientHeight
        if (scrollTop <= 0) { callbackRef.current?.(userIndices[0]); return }
        if (maxScroll <= 0 || scrollTop >= maxScroll - 1) { callbackRef.current?.(userIndices[userIndices.length - 1]); return }
        const topItem = items.find(item => item.start + item.size > scrollTop)
        const topIndex = topItem?.index ?? items[0].index
        const nearest = userIndices.reduce((best, ui) =>
          Math.abs(ui - topIndex) < Math.abs(best - topIndex) ? ui : best
        )
        callbackRef.current?.(nearest)
      }

      el.addEventListener('scroll', report, { passive: true })
      const t = setTimeout(report, 50)
      return () => { clearTimeout(t); el.removeEventListener('scroll', report) }
    }, [filteredMessages, onVisibleUserIndexChange])

    // ── Render ─────────────────────────────────────────────────────────────
    const virtualItems = virtualizer.getVirtualItems()

    return (
      <div ref={scrollRef} className="h-full overflow-y-auto">
        {isLoading && (
          <motion.div
            className="flex items-center justify-center h-full text-sm text-muted-foreground"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading your conversation...</span>
            </div>
          </motion.div>
        )}

        {!isLoading && filteredMessages.length === 0 && (
          <motion.div
            className="flex flex-col items-center justify-center h-full text-center px-8"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
          >
            <img src="/illustrations/empty-messages.svg" alt="Empty conversation" className="w-48 h-48 mb-4 opacity-90" />
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {searchQuery ? 'No matching messages' : 'This conversation is empty'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {searchQuery ? 'Try a different search term.' : 'Type a message below to begin your chat with the agent.'}
            </p>
          </motion.div>
        )}

        {!isLoading && filteredMessages.length > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualItems.map(virtualItem => {
              const message = filteredMessages[virtualItem.index]
              return (
                <div
                  key={message.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="px-4 py-1.5">
                    <MessageBubble
                      message={message}
                      isStreaming={message.id === streamingMessageId}
                      isHighlighted={message.id === highlightedMessageId}
                      searchQuery={searchQuery.trim() ? searchQuery : undefined}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }
)

MessageThread.displayName = 'MessageThread'
