import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import * as React from 'react'
import type { MessageData } from '@/lib/bindings'
import { MessageBubble } from './message-bubble'
import { ThreadNavigator } from './thread-navigator'

export interface MessageThreadHandle {
  scrollToMessage: (index: number) => void
  scrollToIndex: (index: number, options?: { behavior?: 'auto' | 'smooth' }) => void
  getScrollToken: () => ScrollToken
  /** Raw pixel scrollTop — only for the "jump to latest" distance check. */
  getScrollPosition: () => number
  scrollToPosition: (position: number) => void
  getTotalHeight: () => number
  getClientHeight: () => number
}

/**
 * Scroll save/restore token. Stores the topmost visible item index plus how
 * far (in pixels) the viewport has scrolled past the top of that item.
 * This is stable across re-renders because it's in item-space, not pixel-space.
 */
export interface ScrollToken {
  /** Index of the topmost fully-or-partially visible item. */
  index: number
  /**
   * Pixels the viewport has scrolled past the start of `index`.
   * Applied after the virtualizer measures that item.
   */
  offsetWithinItem: number
  /** Total number of messages at save time — used as a sanity check. */
  messageCount: number
}

interface MessageThreadProps {
  messages: MessageData[]
  streamingMessageId?: string
  isLoading?: boolean
  searchQuery?: string
  highlightedMessageId?: string | null
  /** Stable token from a previous mount of this conversation. */
  initialScrollToken?: ScrollToken
  /** Whether to auto-scroll to the bottom while a response is streaming. Default true. */
  autoScroll?: boolean
  /**
   * Called when a dot is clicked in the ThreadNavigator so the parent can
   * flash the highlight ring. Receives the full-array message index.
   */
  onNavigatorScrollTo?: (index: number) => void
}

export const MessageThread = React.forwardRef<MessageThreadHandle, MessageThreadProps>(
  (
    {
      messages,
      streamingMessageId,
      isLoading,
      searchQuery = '',
      highlightedMessageId,
      initialScrollToken,
      autoScroll = true,
      onNavigatorScrollTo,
    },
    ref
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    // ── Filtered message list ──────────────────────────────────────────────
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

    // ── Scroll restoration ─────────────────────────────────────────────────
    //
    // Why pixel offsets break with a virtualizer:
    //   On mount the virtualizer only renders a small window of items using
    //   *estimated* sizes. The total scrollHeight is therefore `count × 120px`
    //   (estimated), which is usually far smaller than the real measured height.
    //   Any pixel offset saved against the real layout cannot be applied until
    //   every item above the target has been measured — a process that only
    //   happens as items scroll into the viewport. Polling via rAF to keep
    //   setting scrollTop just fights this in an unwinnable race.
    //
    // The correct contract is item-space: "the topmost visible item was index N,
    //   and the viewport was M pixels past its leading edge." scrollToIndex()
    //   places that item at the top regardless of whether heights have been
    //   measured, and we apply the sub-item pixel offset in the rAF after
    //   the virtualizer has rendered that item.

    const restorationDoneRef = React.useRef(false)

    React.useLayoutEffect(() => {
      // Guard: only run once, and only when we have items to work with.
      if (restorationDoneRef.current) return
      if (filteredMessages.length === 0) return
      restorationDoneRef.current = true

      if (!initialScrollToken || initialScrollToken.messageCount === 0) {
        // New conversation or no saved position — jump straight to the bottom.
        virtualizerRef.current.scrollToIndex(filteredMessages.length - 1, {
          align: 'end',
          behavior: 'auto',
        })
        return
      }

      // Clamp to valid range in case messages were deleted since the token was saved.
      const safeIndex = Math.min(initialScrollToken.index, filteredMessages.length - 1)

      // Step 1 — synchronously tell the virtualizer which item window to render.
      virtualizerRef.current.scrollToIndex(safeIndex, {
        align: 'start',
        behavior: 'auto',
      })

      // Step 2 — after two rAF ticks the item has been placed in the DOM and
      // measured; now we can apply the fine-grained sub-item pixel offset.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (!el || !initialScrollToken.offsetWithinItem) return
          const items = virtualizerRef.current.getVirtualItems()
          const target = items.find(v => v.index === safeIndex)
          if (!target) return
          const desired = target.start + initialScrollToken.offsetWithinItem
          el.scrollTop = Math.min(desired, el.scrollHeight - el.clientHeight)
        })
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredMessages.length > 0])
    // ^ The dependency is intentionally the boolean "do we have items yet?"
    //   so the effect re-fires once if messages arrive asynchronously after mount.

    // ── Search ─────────────────────────────────────────────────────────────
    React.useLayoutEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }, [searchQuery])

    React.useEffect(() => {
      virtualizerRef.current.measure()
    }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Auto-scroll during streaming ───────────────────────────────────────
    //
    // Fires on every filteredMessages identity change — which includes both
    // new messages being appended AND content updates to the streaming message.
    // Pauses if the user deliberately scrolled up during the stream.

    const prevCountRef = React.useRef(filteredMessages.length)
    const userScrolledUpRef = React.useRef(false)
    const lastStreamingIdRef = React.useRef<string | undefined>(undefined)
    const lastStreamingContentRef = React.useRef<string>('')

    // Reset the pause flag whenever a new stream starts.
    React.useEffect(() => {
      if (streamingMessageId && streamingMessageId !== lastStreamingIdRef.current) {
        userScrolledUpRef.current = false
        lastStreamingIdRef.current = streamingMessageId
      }
      if (!streamingMessageId) {
        lastStreamingIdRef.current = undefined
      }
    }, [streamingMessageId])

    // Detect manual upward scroll while streaming.
    React.useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      const onScroll = () => {
        if (!streamingMessageId) return
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        // > 80px from bottom = user intentionally scrolled up; re-enable when
        // they scroll back down.
        userScrolledUpRef.current = distanceFromBottom > 80
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      return () => el.removeEventListener('scroll', onScroll)
    }, [streamingMessageId])

    // The actual scroll — triggered by content changes, not just count changes.
    React.useEffect(() => {
      if (!autoScroll || !streamingMessageId || searchQuery) return
      if (userScrolledUpRef.current) return

      const streamingMsg = filteredMessages.find(m => m.id === streamingMessageId)
      const currentContent = streamingMsg?.content ?? ''

      const countChanged = filteredMessages.length !== prevCountRef.current
      const contentChanged = currentContent !== lastStreamingContentRef.current

      prevCountRef.current = filteredMessages.length
      lastStreamingContentRef.current = currentContent

      if (countChanged || contentChanged) {
        virtualizerRef.current.scrollToIndex(filteredMessages.length - 1, {
          align: 'end',
          behavior: 'smooth',
        })
      }
    }, [filteredMessages, streamingMessageId, searchQuery, autoScroll])

    // ── Imperative handle ──────────────────────────────────────────────────
    const isProgrammaticScroll = React.useRef(false)
    const programmaticScrollTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useImperativeHandle(ref, () => ({
      scrollToMessage: (index: number) => {
        if (programmaticScrollTimer.current) clearTimeout(programmaticScrollTimer.current)
        isProgrammaticScroll.current = true
        virtualizerRef.current.scrollToIndex(index, { behavior: 'smooth', align: 'start' })
        programmaticScrollTimer.current = setTimeout(() => {
          isProgrammaticScroll.current = false
          programmaticScrollTimer.current = null
        }, 600)
      },
      scrollToIndex: (index, options) =>
        virtualizerRef.current.scrollToIndex(index, options),
      getScrollToken: (): ScrollToken => {
        const el = scrollRef.current
        const msgs = filteredMessagesRef.current
        if (!el) return { index: 0, offsetWithinItem: 0, messageCount: msgs.length }
        const scrollTop = el.scrollTop
        const items = virtualizerRef.current.getVirtualItems()
        const topItem = items.find(item => item.start + item.size > scrollTop) ?? items[0]
        if (!topItem) return { index: 0, offsetWithinItem: 0, messageCount: msgs.length }
        return {
          index: topItem.index,
          offsetWithinItem: Math.max(0, scrollTop - topItem.start),
          messageCount: msgs.length,
        }
      },
      getScrollPosition: () => scrollRef.current?.scrollTop ?? 0,
      scrollToPosition: (pos: number) => {
        if (scrollRef.current) scrollRef.current.scrollTop = pos
      },
      getTotalHeight: () => virtualizerRef.current.getTotalSize(),
      getClientHeight: () => scrollRef.current?.clientHeight ?? 0,
    }), []) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Render ─────────────────────────────────────────────────────────────
    const virtualItems = virtualizer.getVirtualItems()

    return (
      <div className="relative h-full">
        <div ref={scrollRef} className="h-full overflow-y-auto thin-scrollbar">
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
              <img
                src="/illustrations/empty-messages.svg"
                alt="Empty conversation"
                className="w-48 h-48 mb-4 opacity-90"
              />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {searchQuery ? 'No matching messages' : 'This conversation is empty'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Type a message below to begin your chat with the agent.'}
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

        {filteredMessages.length > 2 && (
          <ThreadNavigator
            messages={messages}
            scrollRef={scrollRef}
            virtualizerRef={virtualizerRef}
            onScrollTo={(idx) => onNavigatorScrollTo?.(idx)}
          />
        )}
      </div>
    )
  }
)

MessageThread.displayName = 'MessageThread'
