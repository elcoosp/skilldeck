import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import * as React from 'react'
import type { MessageData } from '@/lib/bindings'
import { MessageBubble } from './message-bubble'
import ThreadNavigator from './thread-navigator'

export interface MessageThreadHandle {
  scrollToMessage: (index: number) => void
  scrollToIndex: (index: number, options?: { behavior?: 'auto' | 'smooth' }) => void
  getScrollToken: () => ScrollToken
  getScrollPosition: () => number
  scrollToPosition: (position: number) => void
  getTotalHeight: () => number
  getClientHeight: () => number
}

export interface ScrollToken {
  // ID of the first visible message when the token was saved.
  // Stable across mounts regardless of virtualizer estimated heights.
  anchorId: string
  // How many pixels the scroll position was past the top of that message.
  // Used for sub-message precision.
  offsetFromAnchor: number
  // Total message count at save time — if it has grown we fall back to bottom.
  messageCount: number
}

type ScrollIntent = 'idle' | 'restoring' | 'navigating' | 'streaming'

interface MessageThreadProps {
  messages: MessageData[]
  streamingMessageId?: string
  isLoading?: boolean
  searchQuery?: string
  highlightedMessageId?: string | null
  initialScrollToken?: ScrollToken
  autoScroll?: boolean
  onNavigatorScrollTo?: (index: number) => void
  onManualScroll?: () => void
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
      onManualScroll,
    },
    ref
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    const filteredMessages = React.useMemo(() => {
      if (!searchQuery.trim()) return messages
      const q = searchQuery.toLowerCase()
      return messages.filter((m) => m.content.toLowerCase().includes(q))
    }, [messages, searchQuery])

    const filteredMessagesRef = React.useRef(filteredMessages)
    filteredMessagesRef.current = filteredMessages

    // ─── Scroll intent ────────────────────────────────────────────────────────
    const scrollIntent = React.useRef<ScrollIntent>('idle')
    const intentTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    const setIntent = React.useCallback((intent: ScrollIntent, durationMs = 150) => {
      if (intentTimerRef.current) clearTimeout(intentTimerRef.current)
      scrollIntent.current = intent
      if (intent !== 'idle') {
        intentTimerRef.current = setTimeout(() => {
          scrollIntent.current = 'idle'
          intentTimerRef.current = null
        }, durationMs)
      }
    }, [])

    // ─── Pending correction ───────────────────────────────────────────────────
    // Tracks a scroll target that needs correcting once the target item has been
    // truly measured (not just estimated) by the virtualizer.
    //
    // The key insight: getVirtualItems() returns items with their ESTIMATED size
    // until measureElement() runs on the DOM node. We must not read target.start
    // until the cache entry for that index shows a size different from the
    // estimate — only then is the position accurate for dynamic-height rows.
    const pendingCorrectionRef = React.useRef<{
      index: number
      mode: 'navigate' | 'restore'
      // 'restore' only: pixel offset from the top of the anchor item to apply
      // once the convergence loop has placed that item correctly on screen.
      offsetFromAnchor?: number
      // Convergence detection: position recorded after the most recent
      // scrollToIndex call we issued. undefined = no scroll issued yet.
      lastScrollTopAfterScroll?: number
      // Whether we have issued at least one scrollToIndex in this correction pass.
      hasScrolled: boolean
    } | null>(null)

    // ─── Virtualizer ──────────────────────────────────────────────────────────
    const virtualizer = useVirtualizer({
      count: filteredMessages.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => 500,
      overscan: 5,
      measureElement: (el) => el.getBoundingClientRect().height,
      onChange: (instance) => {
        const pending = pendingCorrectionRef.current
        if (!pending) return
        if (instance.isScrolling) return

        const el = scrollRef.current
        if (!el) {
          pendingCorrectionRef.current = null
          return
        }

        const currentScrollTop = el.scrollTop
        const intent = pending.mode === 'restore' ? 'restoring' : 'navigating'

        // onChange fires both when scroll position changes AND when items are
        // measured. We must not treat a measurement-only event as convergence —
        // the position may be stable only because we haven't scrolled yet, not
        // because the target is correctly positioned.
        //
        // Convergence requires:
        //   (a) we have issued at least one scrollToIndex toward the target, AND
        //   (b) the position did not change after that scroll (within 4px).
        //
        // If (a) is not met, always issue a scroll first.
        // If (a) is met but (b) is not, record the new position and scroll again.
        // If both are met, the target is correctly positioned — apply any offset.
        if (!pending.hasScrolled) {
          // First call: issue the initial scroll toward the target.
          pending.hasScrolled = true
          pending.lastScrollTopAfterScroll = currentScrollTop
          setIntent(intent, 300)
          instance.scrollToIndex(pending.index, { behavior: 'auto', align: 'start' })
          return
        }

        const settled =
          pending.lastScrollTopAfterScroll !== undefined &&
          Math.abs(currentScrollTop - pending.lastScrollTopAfterScroll) <= 4

        if (!settled) {
          // Position moved after our last scroll — measurements updated the layout.
          // Record and scroll again.
          pending.lastScrollTopAfterScroll = currentScrollTop
          setIntent(intent, 300)
          instance.scrollToIndex(pending.index, { behavior: 'auto', align: 'start' })
          return
        }

        // Converged. For restore mode, add the sub-item offset on top.
        if (pending.mode === 'restore' && pending.offsetFromAnchor != null && pending.offsetFromAnchor > 0) {
          const desired = Math.min(
            currentScrollTop + pending.offsetFromAnchor,
            el.scrollHeight - el.clientHeight
          )
          if (Math.abs(currentScrollTop - desired) > 4) {
            pendingCorrectionRef.current = null
            setIntent('restoring', 200)
            el.scrollTop = desired
            return
          }
        }

        pendingCorrectionRef.current = null
      },
    })

    const virtualizerRef = React.useRef(virtualizer)
    virtualizerRef.current = virtualizer

    // ─── Restoration ─────────────────────────────────────────────────────────
    const restorationDoneRef = React.useRef(false)

    React.useLayoutEffect(() => {
      if (restorationDoneRef.current) return
      if (filteredMessages.length === 0) return

      restorationDoneRef.current = true
      setIntent('restoring', 300)

      const token = initialScrollToken
      const countMatches = token != null && token.messageCount === filteredMessages.length

      if (!token || !countMatches) {
        // No saved position or conversation has grown since last visit — go to bottom.
        virtualizer.scrollToIndex(filteredMessages.length - 1, { align: 'end', behavior: 'auto' })
        return
      }

      // Resolve anchor message ID → index. Message IDs are stable regardless of
      // virtualizer height estimates, so this lookup is always accurate.
      const anchorIndex = filteredMessages.findIndex((m) => m.id === token.anchorId)
      if (anchorIndex === -1) {
        // Anchor message no longer exists (e.g. deleted) — fall back to bottom.
        virtualizer.scrollToIndex(filteredMessages.length - 1, { align: 'end', behavior: 'auto' })
        return
      }

      // Register the correction pass. The convergence loop in onChange will call
      // scrollToIndex(anchorIndex) until the position stabilises, then apply
      // offsetFromAnchor to land at the exact sub-item pixel.
      pendingCorrectionRef.current = {
        index: anchorIndex,
        mode: 'restore',
        offsetFromAnchor: token.offsetFromAnchor,
        hasScrolled: false,
      }

      virtualizer.scrollToIndex(anchorIndex, { align: 'start', behavior: 'auto' })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredMessages.length])

    // ─── Search resets ────────────────────────────────────────────────────────
    React.useLayoutEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }, [searchQuery])

    React.useEffect(() => {
      virtualizer.measure()
    }, [searchQuery, virtualizer])

    // ─── Streaming auto-scroll ────────────────────────────────────────────────
    const prevCountRef = React.useRef(filteredMessages.length)
    const userScrolledUpRef = React.useRef(false)
    const lastStreamingIdRef = React.useRef<string | undefined>(undefined)
    const lastStreamingContentRef = React.useRef<string>('')

    React.useEffect(() => {
      if (streamingMessageId && streamingMessageId !== lastStreamingIdRef.current) {
        userScrolledUpRef.current = false
        lastStreamingIdRef.current = streamingMessageId
      }
      if (!streamingMessageId) {
        lastStreamingIdRef.current = undefined
      }
    }, [streamingMessageId])

    React.useEffect(() => {
      if (!autoScroll || !streamingMessageId || searchQuery) return
      if (userScrolledUpRef.current) return

      const streamingMsg = filteredMessages.find((m) => m.id === streamingMessageId)
      const currentContent = streamingMsg?.content ?? ''

      const countChanged = filteredMessages.length !== prevCountRef.current
      const contentChanged = currentContent !== lastStreamingContentRef.current

      prevCountRef.current = filteredMessages.length
      lastStreamingContentRef.current = currentContent

      if (countChanged || contentChanged) {
        setIntent('streaming', 150)
        virtualizer.scrollToIndex(filteredMessages.length - 1, { align: 'end', behavior: 'smooth' })
      }
    }, [filteredMessages, streamingMessageId, searchQuery, autoScroll, virtualizer, setIntent])

    // ─── Scroll listener ──────────────────────────────────────────────────────
    React.useEffect(() => {
      const el = scrollRef.current
      if (!el) return

      const onScroll = () => {
        if (scrollIntent.current !== 'idle') return
        onManualScroll?.()
        if (streamingMessageId) {
          const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
          userScrolledUpRef.current = distanceFromBottom > 80
        }
      }

      el.addEventListener('scroll', onScroll, { passive: true })
      return () => el.removeEventListener('scroll', onScroll)
    }, [streamingMessageId, onManualScroll])

    // ─── Navigator scroll ─────────────────────────────────────────────────────
    const handleNavigatorScrollTo = React.useCallback(
      (idx: number) => {
        onNavigatorScrollTo?.(idx)
        pendingCorrectionRef.current = null
        setIntent('navigating', 300)
        pendingCorrectionRef.current = { index: idx, mode: 'navigate', hasScrolled: false }
        virtualizer.scrollToIndex(idx, { align: 'start', behavior: 'auto' })
      },
      [onNavigatorScrollTo, virtualizer, setIntent]
    )

    // ─── Imperative handle ────────────────────────────────────────────────────
    React.useImperativeHandle(
      ref,
      () => ({
        scrollToMessage: (index: number) => {
          pendingCorrectionRef.current = null
          setIntent('navigating', 600)
          pendingCorrectionRef.current = { index, mode: 'navigate', hasScrolled: false }
          virtualizer.scrollToIndex(index, { behavior: 'smooth', align: 'start' })
        },
        scrollToIndex: (index, options) => {
          pendingCorrectionRef.current = null
          setIntent('navigating', 300)
          pendingCorrectionRef.current = { index, mode: 'navigate', hasScrolled: false }
          virtualizer.scrollToIndex(index, options)
        },
        getScrollToken: (): ScrollToken => {
          const el = scrollRef.current
          const msgs = filteredMessagesRef.current
          const count = msgs.length
          if (!el || count === 0) {
            return { anchorId: '', offsetFromAnchor: 0, messageCount: count }
          }

          const scrollTop = el.scrollTop
          const items = virtualizerRef.current.getVirtualItems()

          // Find the first virtual item whose bottom edge is below the current
          // scrollTop — that is the topmost visible message.
          const topItem = items.find((item) => item.start + item.size > scrollTop) ?? items[0]
          if (!topItem) {
            return { anchorId: '', offsetFromAnchor: 0, messageCount: count }
          }

          const anchorMessage = msgs[topItem.index]
          return {
            anchorId: anchorMessage?.id ?? '',
            // How many px past the top of this item the viewport currently sits.
            offsetFromAnchor: Math.max(0, scrollTop - topItem.start),
            messageCount: count,
          }
        },
        getScrollPosition: () => scrollRef.current?.scrollTop ?? 0,
        scrollToPosition: (pos: number) => {
          const el = scrollRef.current
          if (!el) return
          setIntent('navigating', 150)
          el.scrollTop = pos
        },
        getTotalHeight: () => virtualizer.getTotalSize(),
        getClientHeight: () => scrollRef.current?.clientHeight ?? 0,
      }),
      [virtualizer, setIntent]
    )

    // ─── Render ───────────────────────────────────────────────────────────────
    const virtualItems = virtualizer.getVirtualItems()

    return (
      <div className="relative h-full">
        <div ref={scrollRef} className="h-full overflow-y-auto thin-scrollbar">
          {isLoading && (
            <motion.div
              className="flex items-center justify-center h-full text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
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
              {virtualItems.map((virtualItem) => {
                const message = filteredMessages[virtualItem.index]
                return (
                  <div
                    key={message.id}
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    data-message-index={virtualItem.index}
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
            messages={filteredMessages}
            scrollRef={scrollRef}
            virtualizerRef={virtualizerRef}
            onScrollTo={handleNavigatorScrollTo}
          />
        )}
      </div>
    )
  }
)

MessageThread.displayName = 'MessageThread'
