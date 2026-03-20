import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import * as React from 'react'
import type { MessageData } from '@/lib/bindings'
import { MessageBubble } from './message-bubble'

// ─── Scroll token ─────────────────────────────────────────────────────────────
// We save the message ID of the topmost visible item, not a pixel offset or a
// virtualizer index.
//
// Why ID instead of index + offsetFromTop:
//   • The virtualizer's `item.start` is TRANSIENT — it reflects estimated sizes
//     at the moment of capture. When a navigator click is in-flight, items are
//     still measuring and totalSize is collapsing. A large `offsetFromTop` (e.g.
//     14282px from inside a 600px estimated / 14283px actual assistant block)
//     subtracts from a `scrollTop` of 0 after restore, clamping to 0 = top.
//   • Message IDs are stable across mounts. We look up the ID in the new
//     filteredMessages array to get the current filtered index, then call
//     `scrollToIndex(index, { align: 'start' })` — no pixel math at all.
//   • `scrollToIndex` with `align:'start'` is exactly what TanStack is designed
//     for: it handles estimated vs actual sizes internally.
export interface ScrollToken {
  /** The stable message ID of the topmost fully-or-partially visible item. */
  messageId: string
  /**
   * The exact scrollTop at capture time (px). All items in the viewport have
   * been measured by the virtualizer at this point, so this is the true pixel
   * offset — not an estimate. We use it directly as `initialOffset` on the next
   * mount so the virtualizer seeds its internal state at the right position.
   */
  scrollTop: number
}

export interface MessageThreadHandle {
  /** Scroll to a message by its index in the *full* (unfiltered) messages array. */
  scrollToMessage: (index: number) => void
  scrollToIndex: (index: number, options?: { behavior?: 'auto' | 'smooth'; align?: 'start' | 'center' | 'end' }) => void
  /** Capture the current scroll position as a stable ID-based token. */
  getScrollToken: () => ScrollToken | null
  getTotalHeight: () => number
  getClientHeight: () => number
  getScrollPosition: () => number
  /** Subscribe to scroll events on the inner scroll element. Returns unsubscribe fn. */
  onScroll: (cb: () => void) => () => void
}

interface MessageThreadProps {
  messages: MessageData[]
  streamingMessageId?: string
  isLoading?: boolean
  searchQuery?: string
  highlightedMessageId?: string | null
  /** ID-based token from getScrollToken() — used to restore position on mount. */
  initialScrollToken?: ScrollToken | null
  autoScroll?: boolean
  /** Reports the index (in the full messages array) of the user message nearest the viewport centre. */
  onVisibleUserIndexChange?: (index: number) => void
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
      onVisibleUserIndexChange,
    },
    ref
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const renderCount = React.useRef(0)
    renderCount.current++

    console.log(`[MessageThread] render #${renderCount.current} | messages=${messages.length} query="${searchQuery}" streaming=${streamingMessageId ?? 'none'} token=${initialScrollToken?.messageId ?? 'none'}`)

    // ─── Filtered messages ───────────────────────────────────────────────────
    const filteredMessages = React.useMemo(() => {
      if (!searchQuery.trim()) {
        console.log(`[MessageThread][filter] no query — returning all ${messages.length} messages`)
        return messages
      }
      const q = searchQuery.toLowerCase()
      const result = messages.filter((m) => m.content.toLowerCase().includes(q))
      console.log(`[MessageThread][filter] query="${searchQuery}" matched ${result.length}/${messages.length}`)
      return result
    }, [messages, searchQuery])

    const filteredMessagesRef = React.useRef(filteredMessages)
    filteredMessagesRef.current = filteredMessages

    // ─── Restoration state (declared before virtualizer) ─────────────────────
    // restorationAppliedRef: one-shot guard so we only call scrollToIndex once.
    // initialScrollTokenRef: stable ref so the onChange closure reads the token
    // without becoming stale across re-renders.
    const restorationAppliedRef = React.useRef(false)
    const restorationSeededRef = React.useRef(false)
    const initialScrollTokenRef = React.useRef(initialScrollToken)
    // computedInitialOffset: non-zero means a restore token is present.
    // Used as the guard for InitScroll / StreamScroll — no pixel math involved.
    const computedInitialOffset = React.useMemo(() => {
      if (!initialScrollToken || typeof initialScrollToken.messageId !== 'string') return 0
      console.log(`[Restoration] token present — messageId=${initialScrollToken.messageId}`)
      return 1 // truthy sentinel; actual scroll done via scrollToIndex below
    }, []) // eslint-disable-line react-hooks/exhaustive-deps — mount-only

    // ─── Virtualizer ─────────────────────────────────────────────────────────
    const virtualizer = useVirtualizer({
      count: filteredMessages.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: (index) => {
        const msg = filteredMessages[index]
        const estimate = msg?.role === 'assistant' ? 600 : 80
        console.log(`[Virtualizer][estimateSize] index=${index} role=${msg?.role ?? 'unknown'} estimate=${estimate}px`)
        return estimate
      },
      overscan: 8,
      measureElement: (el) => {
        const h = el.getBoundingClientRect().height
        console.log(`[Virtualizer][measureElement] data-index=${el.dataset.index} height=${h}px`)
        return h
      },
      onChange: (instance, sync) => {
        const items = instance.getVirtualItems()
        const range = items.length > 0 ? `[${items[0].index}…${items[items.length - 1].index}]` : 'empty'
        console.log(`[Virtualizer][onChange] sync=${sync} offset=${instance.scrollOffset} totalSize=${instance.getTotalSize()} range=${range} isScrolling=${instance.isScrolling} dir=${instance.scrollDirection ?? 'none'}`)

        // ── Scroll restoration ────────────────────────────────────────────────
        // Strategy:
        //   Phase 1: target not yet rendered → use scrollToOffset with a rough
        //            estimate to bring the target into the rendered range.
        //   Phase 2: target is in range (measured) → call scrollToIndex for the
        //            precise position. scrollToIndex uses real measured sizes, so
        //            it lands correctly even for 14000px+ assistant messages.
        if (!restorationAppliedRef.current && items.length > 0) {
          const token = initialScrollTokenRef.current
          if (token && typeof token.messageId === 'string') {
            const idx = filteredMessagesRef.current.findIndex((m) => m.id === token.messageId)
            if (idx !== -1) {
              const firstIdx = items[0].index
              const lastIdx = items[items.length - 1].index
              const targetInRange = idx >= firstIdx && idx <= lastIdx

              if (targetInRange && !instance.isScrolling) {
                // Phase 2: target is rendered and measured — lock in the position.
                restorationAppliedRef.current = true
                console.log(`[Restoration] ✅ target=${idx} measured in range=[${firstIdx}…${lastIdx}] — scrollToIndex`)
                requestAnimationFrame(() => {
                  instance.scrollToIndex(idx, { align: 'start', behavior: 'auto' })
                })
              } else if (!targetInRange && !restorationSeededRef.current) {
                // Phase 1: target not yet rendered — scroll close enough to bring it in.
                restorationSeededRef.current = true
                // Estimate the pixel offset: sum estimated sizes of items before target.
                let estimatedOffset = 0
                for (let i = 0; i < idx; i++) {
                  const msg = filteredMessagesRef.current[i]
                  estimatedOffset += msg?.role === 'assistant' ? 600 : 80
                }
                console.log(`[Restoration] phase-1 seed scrollToOffset=${estimatedOffset} to bring target=${idx} into range`)
                instance.scrollToOffset(estimatedOffset, { behavior: 'auto' })
              }
            } else {
              console.warn(`[Restoration] messageId=${token.messageId} not found — skipping`)
              restorationAppliedRef.current = true
            }
          }
        }
      },
    })

    const virtualizerRef = React.useRef(virtualizer)
    virtualizerRef.current = virtualizer

    // ─── 1. Scroll Restoration ────────────────────────────────────────────────
    // Handled inside onChange above.

    // ─── 2. New Conversation — scroll to bottom ───────────────────────────────
    const sentToBottomRef = React.useRef(false)

    React.useEffect(() => {
      const hasRestoreToken = !!computedInitialOffset
      console.log(`[InitScroll] length=${filteredMessages.length} hasRestoreToken=${hasRestoreToken} sentToBottom=${sentToBottomRef.current}`)

      if (hasRestoreToken) {
        sentToBottomRef.current = true
        console.log('[InitScroll] restore token present — skipping')
        return
      }
      if (sentToBottomRef.current) {
        console.log('[InitScroll] already sent — skipping')
        return
      }
      if (filteredMessages.length === 0) {
        console.log('[InitScroll] no messages yet — deferring')
        return
      }

      sentToBottomRef.current = true
      const idx = filteredMessages.length - 1
      console.log(`[InitScroll] 📉 new conversation — scrollToIndex(${idx}, end, auto)`)
      virtualizerRef.current.scrollToIndex(idx, { align: 'end', behavior: 'auto' })
    }, [filteredMessages.length, computedInitialOffset])

    // ─── 3. Search — reset scroll ─────────────────────────────────────────────
    React.useLayoutEffect(() => {
      if (searchQuery.trim()) {
        console.log(`[SearchReset] query="${searchQuery}" — scrollToOffset(0)`)
        virtualizerRef.current.scrollToOffset(0, { behavior: 'auto' })
      }
    }, [searchQuery])

    React.useEffect(() => {
      if (searchQuery.trim()) {
        console.log(`[SearchReset] query="${searchQuery}" — measure()`)
        virtualizerRef.current.measure()
      }
    }, [searchQuery])

    // ─── 4. Streaming Auto-scroll ─────────────────────────────────────────────
    const prevCountRef = React.useRef(filteredMessages.length)

    React.useEffect(() => {
      const prev = prevCountRef.current
      const curr = filteredMessages.length
      prevCountRef.current = curr

      const hasRestoreToken = !!computedInitialOffset

      if (hasRestoreToken || !autoScroll || !streamingMessageId || curr <= prev || searchQuery) {
        console.log(`[StreamScroll] skipping — hasRestore=${hasRestoreToken} autoScroll=${autoScroll} streaming=${streamingMessageId ?? 'none'} prev=${prev} curr=${curr} search="${searchQuery}"`)
        return
      }

      const idx = curr - 1
      console.log(`[StreamScroll] 🔴 new message — scrollToIndex(${idx}, end, smooth)`)
      virtualizerRef.current.scrollToIndex(idx, { behavior: 'smooth', align: 'end' })
    }, [filteredMessages.length, streamingMessageId, searchQuery, autoScroll, computedInitialOffset])

    // ─── 5. Visible User Index Tracking ──────────────────────────────────────
    // Uses topmost-visible-item logic (same as getScrollToken) then walks back
    // to the nearest preceding user message. Pure index-based, no pixel heuristics.

    const callbackRef = React.useRef(onVisibleUserIndexChange)
    React.useLayoutEffect(() => {
      callbackRef.current = onVisibleUserIndexChange
    })

    React.useEffect(() => {
      const el = scrollRef.current
      if (!el || !onVisibleUserIndexChange) {
        console.log('[VisibleIndex] skipping — no element or no callback')
        return
      }

      const filteredToFull = new Map<number, number>()
      filteredMessages.forEach((msg, fi) => {
        const fullIndex = messages.findIndex((m) => m.id === msg.id)
        if (fullIndex !== -1) filteredToFull.set(fi, fullIndex)
      })

      const userFilteredIndices = filteredMessages
        .map((m, i) => (m.role === 'user' ? i : -1))
        .filter((i) => i !== -1)

      console.log(`[VisibleIndex] setup — userFilteredIndices=${userFilteredIndices.length} filteredToFull=${filteredToFull.size}`)

      if (userFilteredIndices.length === 0) {
        console.log('[VisibleIndex] no user messages — skipping')
        return
      }

      let lastReportedFullIndex = -1

      const report = () => {
        const vItems = virtualizerRef.current.getVirtualItems()
        if (vItems.length === 0) return

        const scrollTop = el.scrollTop

        // Topmost rendered item whose start is at or above scrollTop.
        let topItem = vItems[0]
        for (const item of vItems) {
          if (item.start <= scrollTop) topItem = item
          else break
        }

        // Last user message at or before the topmost item index.
        let bestUserFilteredIndex = userFilteredIndices[0]
        for (const ui of userFilteredIndices) {
          if (ui <= topItem.index) bestUserFilteredIndex = ui
          else break
        }

        const fullIndex = filteredToFull.get(bestUserFilteredIndex) ?? -1
        console.log(`[VisibleIndex][report] scrollTop=${scrollTop} topItem=${topItem.index} bestUserFiltered=${bestUserFilteredIndex} fullIndex=${fullIndex} lastReported=${lastReportedFullIndex}`)

        if (fullIndex !== -1 && fullIndex !== lastReportedFullIndex) {
          lastReportedFullIndex = fullIndex
          console.log(`[VisibleIndex][report] 📡 reporting fullIndex=${fullIndex}`)
          callbackRef.current?.(fullIndex)
        }
      }

      el.addEventListener('scroll', report, { passive: true })
      const t = setTimeout(report, 50)
      console.log('[VisibleIndex] scroll listener attached')

      return () => {
        console.log('[VisibleIndex] 🧹 cleanup')
        clearTimeout(t)
        el.removeEventListener('scroll', report)
      }
    }, [filteredMessages, messages, onVisibleUserIndexChange])

    // ─── Imperative handle ───────────────────────────────────────────────────
    React.useImperativeHandle(
      ref,
      () => ({
        scrollToMessage: (fullIndex: number) => {
          const targetId = messages[fullIndex]?.id
          if (!targetId) {
            console.warn(`[Imperative][scrollToMessage] no message at fullIndex=${fullIndex}`)
            return
          }
          const filteredIndex = filteredMessagesRef.current.findIndex((m) => m.id === targetId)
          if (filteredIndex === -1) {
            console.warn(`[Imperative][scrollToMessage] id=${targetId} not in filtered set (search active?)`)
            return
          }
          console.log(`[Imperative][scrollToMessage] fullIndex=${fullIndex} id=${targetId} → filteredIndex=${filteredIndex}`)
          virtualizerRef.current.scrollToIndex(filteredIndex, { behavior: 'auto', align: 'start' })
        },

        scrollToIndex: (index, options) => {
          console.log(`[Imperative][scrollToIndex] index=${index} options=${JSON.stringify(options ?? {})}`)
          virtualizerRef.current.scrollToIndex(index, options)
        },

        getScrollToken: (): ScrollToken | null => {
          const el = scrollRef.current
          if (!el) return null
          const vItems = virtualizerRef.current.getVirtualItems()
          if (vItems.length === 0) return null

          const scrollTop = el.scrollTop

          // Find the topmost rendered item whose start is at or above scrollTop.
          let topItem = vItems[0]
          for (const item of vItems) {
            if (item.start <= scrollTop) topItem = item
            else break
          }

          const message = filteredMessagesRef.current[topItem.index]
          if (!message) {
            console.warn(`[Imperative][getScrollToken] no message at filteredIndex=${topItem.index}`)
            return null
          }

          const token: ScrollToken = { messageId: message.id, scrollTop }
          console.log(`[Imperative][getScrollToken] scrollTop=${scrollTop} topItem.index=${topItem.index} topItem.start=${topItem.start} messageId=${message.id} content="${message.content.slice(0, 30)}"`)
          return token
        },

        getTotalHeight: () => virtualizerRef.current.getTotalSize(),

        getClientHeight: () => scrollRef.current?.clientHeight ?? 0,

        getScrollPosition: () => scrollRef.current?.scrollTop ?? 0,

        onScroll: (cb: () => void) => {
          const el = scrollRef.current
          if (!el) return () => { }
          el.addEventListener('scroll', cb, { passive: true })
          return () => el.removeEventListener('scroll', cb)
        },
      }),
      [messages]
    )

    // ─── Render ──────────────────────────────────────────────────────────────
    const virtualItems = virtualizer.getVirtualItems()
    const range = virtualItems.length > 0
      ? `[${virtualItems[0].index}…${virtualItems[virtualItems.length - 1].index}]`
      : 'empty'

    console.log(`[MessageThread][render] #${renderCount.current} filtered=${filteredMessages.length} items=${virtualItems.length} totalSize=${virtualizer.getTotalSize()} range=${range} offset=${virtualizer.scrollOffset}`)

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
              {virtualItems.map((virtualItem) => {
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
      </div>
    )
  }
)

MessageThread.displayName = 'MessageThread'
