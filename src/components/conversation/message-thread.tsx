import { useVirtualizer, elementScroll } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import * as React from 'react'
import type { MessageData } from '@/lib/bindings'
import { MessageBubble } from './message-bubble'

// ─── Scroll token ─────────────────────────────────────────────────────────────
export interface ScrollToken {
  messageId: string
  scrollTop: number
}

export interface MessageThreadHandle {
  scrollToMessage: (fullIndex: number) => void
  scrollToBottom: () => void
  getScrollElement: () => HTMLElement | null
  getScrollToken: () => ScrollToken | null
  getScrollPosition: () => number
  onScroll: (cb: () => void) => () => void
}

interface MessageThreadProps {
  messages: MessageData[]
  streamingMessageId?: string
  isLoading?: boolean
  searchQuery?: string
  highlightedMessageId?: string | null
  initialScrollToken?: ScrollToken | null
  autoScroll?: boolean
  onVisibleUserIndexChange?: (index: number) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function distFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight
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

    // ─── Filtered messages ───────────────────────────────────────────────────
    const filteredMessages = React.useMemo(() => {
      if (!searchQuery.trim()) return messages
      const q = searchQuery.toLowerCase()
      return messages.filter((m) => m.content.toLowerCase().includes(q))
    }, [messages, searchQuery])

    const filteredMessagesRef = React.useRef(filteredMessages)
    filteredMessagesRef.current = filteredMessages

    // ─── Measured size cache (survives re-renders) ───────────────────────────
    const measuredSizesRef = React.useRef<Map<string, number>>(new Map())

    // ─── Programmatic scroll tracking ────────────────────────────────────────
    // When WE scroll (not the user), we set this to true so the scroll listener
    // doesn't treat our scrolls as "user scrolled away".
    const isProgrammaticScrollRef = React.useRef(false)

    // ─── User-away-from-bottom state ─────────────────────────────────────────
    // True when the user has manually scrolled up during streaming.
    // Cleared when they return near bottom or a new stream starts.
    const userScrolledAwayRef = React.useRef(false)

    // ─── Refs for stable access inside callbacks ─────────────────────────────
    const autoScrollRef = React.useRef(autoScroll)
    autoScrollRef.current = autoScroll
    const streamingRef = React.useRef(streamingMessageId)
    streamingRef.current = streamingMessageId

    // ─── Scroll restoration state ─────────────────────────────────────────────
    const restorationAppliedRef = React.useRef(false)
    const restorationSeededRef = React.useRef(false)
    const initialScrollTokenRef = React.useRef(initialScrollToken)

    const hasRestoreToken = React.useMemo(
      () => !!(initialScrollToken?.messageId),
      [] // eslint-disable-line react-hooks/exhaustive-deps — mount-only
    )

    // ─── scrollToFn: intercept ALL virtualizer scrolls ────────────────────────
    // This is the single place where programmatic scrolls happen.
    // We set isProgrammaticScrollRef so the scroll listener ignores them.
    const scrollToFn: React.ComponentProps<typeof useVirtualizer>['scrollToFn'] =
      React.useCallback((offset, { behavior }, instance) => {
        isProgrammaticScrollRef.current = true
        elementScroll(offset, { behavior }, instance)
        // Reset after scroll event fires (next frame is enough)
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false
        })
      }, [])

    // ─── Dynamic estimate based on measured average ──────────────────────────
    // As messages get measured, we track the average assistant height.
    // This converges quickly and reduces first-measurement jumps.
    const avgAssistantHeightRef = React.useRef(400)

    const updateAvgAssistantHeight = React.useCallback((newHeight: number) => {
      // Exponential moving average — weight recent measurements more
      avgAssistantHeightRef.current = Math.round(
        avgAssistantHeightRef.current * 0.7 + newHeight * 0.3
      )
    }, [])
    const virtualizer = useVirtualizer({
      count: filteredMessages.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: (index) => {
        // Use ref so we always read the latest filteredMessages — the closure
        // over `filteredMessages` stales between renders causing index mismatches.
        const msg = filteredMessagesRef.current[index]
        if (!msg) return 80
        const known = measuredSizesRef.current.get(msg.id)
        if (known) return known
        return msg.role === 'assistant' ? avgAssistantHeightRef.current : 80
      },
      overscan: 5,
      // Defer ResizeObserver measurements to the next animation frame.
      // This ensures we measure after Shiki syntax highlighting and markdown
      // rendering have completed their reflows, not at the skeleton 80px height.
      useAnimationFrameWithResizeObserver: true,
      measureElement: (el) => {
        const h = el.getBoundingClientRect().height
        const msgId = (el as HTMLElement).dataset.msgId
        if (msgId) {
          const prev = measuredSizesRef.current.get(msgId)
          const role = (el as HTMLElement).dataset.role ?? 'user'
          const estimate = prev ?? (role === 'assistant' ? avgAssistantHeightRef.current : 80)
          const delta = h - estimate
          if (Math.abs(delta) > 50) {
            console.log(`[Measure] msgId=${msgId.slice(0, 8)} role=${role} estimated=${estimate} actual=${h} delta=${delta}`)
          }
          measuredSizesRef.current.set(msgId, h)
          if (role === 'assistant' && !prev) {
            updateAvgAssistantHeight(h)
          }
        }
        return h
      },
      scrollToFn,
      onChange: (instance) => {
        const items = instance.getVirtualItems()
        if (items.length === 0) return

        const el = instance.scrollElement as HTMLElement | null
        const dist = el ? distFromBottom(el) : 999
        const dir = instance.scrollDirection ?? 'none'
        const range = `${items[0].index}..${items[items.length - 1].index}`
        console.log(`[onChange] dir=${dir} offset=${instance.scrollOffset} total=${Math.round(instance.getTotalSize())} dist=${Math.round(dist)} range=${range} scrolling=${instance.isScrolling}`)

        // ── Phase 1: Scroll restoration ──────────────────────────────────────
        if (!restorationAppliedRef.current) {
          const token = initialScrollTokenRef.current
          if (token?.messageId) {
            const idx = filteredMessagesRef.current.findIndex((m) => m.id === token.messageId)
            if (idx === -1) {
              restorationAppliedRef.current = true
              return
            }
            const inRange = idx >= items[0].index && idx <= items[items.length - 1].index
            if (inRange && !instance.isScrolling) {
              restorationAppliedRef.current = true
              console.log(`[Restoration] target=${idx} in range — scrollToIndex`)
              requestAnimationFrame(() =>
                instance.scrollToIndex(idx, { align: 'start', behavior: 'auto' })
              )
            } else if (!inRange && !restorationSeededRef.current) {
              restorationSeededRef.current = true
              let offset = 0
              for (let i = 0; i < idx; i++) {
                const m = filteredMessagesRef.current[i]
                offset += measuredSizesRef.current.get(m?.id ?? '') ??
                  (m?.role === 'assistant' ? avgAssistantHeightRef.current : 80)
              }
              console.log(`[Restoration] seed offset=${offset} for target idx=${idx}`)
              instance.scrollToOffset(offset, { behavior: 'auto' })
            }
          } else {
            restorationAppliedRef.current = true
          }
          return
        }

        // ── Phase 2: Non-streaming near-bottom auto-scroll ───────────────────
        // Only fire when: autoScroll enabled, not streaming, not user-scrolling,
        // and truly at the bottom (dist=0, not a loose threshold that misfires).
        if (!autoScrollRef.current) return
        if (streamingRef.current) return
        if (!el) return
        if (userScrolledAwayRef.current) return
        // Use dist=0 — only snap when literally at the bottom, not within 150px.
        // The 150px threshold was causing this to fight user backward scrolling.
        if (dist === 0) {
          const lastIdx = filteredMessagesRef.current.length - 1
          if (lastIdx >= 0) {
            console.log(`[AutoScroll] at-bottom dir=${dir} — scrolling to ${lastIdx}`)
            instance.scrollToIndex(lastIdx, { align: 'end', behavior: 'auto' })
          }
        }
      },
    })

    const virtualizerRef = React.useRef(virtualizer)
    virtualizerRef.current = virtualizer

    // Assign on the instance (not an option) — always false to prevent
    // scroll position jumping when items above viewport measure differently.
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false

    // ─── User scroll detection ────────────────────────────────────────────────
    React.useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      const onScroll = () => {
        if (isProgrammaticScrollRef.current) return
        const dist = distFromBottom(el)
        console.log(`[UserScroll] scrollTop=${Math.round(el.scrollTop)} dist=${Math.round(dist)} programmatic=${isProgrammaticScrollRef.current}`)
        if (dist > 100) {
          userScrolledAwayRef.current = true
        } else {
          userScrolledAwayRef.current = false
        }
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      return () => el.removeEventListener('scroll', onScroll)
    }, [])

    // ─── Warm measurement cache on mount ─────────────────────────────────────
    // Trigger a measure pass after mount so visible items are in the cache
    // before the user scrolls backward. Without this, the first backward scroll
    // always hits cold estimates causing a jump.
    React.useLayoutEffect(() => {
      virtualizerRef.current.measure()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Initial scroll (new conversation, no restore token) ─────────────────
    const sentToBottomRef = React.useRef(false)
    React.useEffect(() => {
      if (hasRestoreToken) { sentToBottomRef.current = true; return }
      if (sentToBottomRef.current) return
      if (filteredMessages.length === 0) return
      sentToBottomRef.current = true
      virtualizerRef.current.scrollToIndex(filteredMessages.length - 1, { align: 'end', behavior: 'auto' })
    }, [filteredMessages.length, hasRestoreToken])

    // ─── Search reset ─────────────────────────────────────────────────────────
    React.useLayoutEffect(() => {
      if (searchQuery.trim()) virtualizerRef.current.scrollToOffset(0, { behavior: 'auto' })
    }, [searchQuery])
    React.useEffect(() => {
      if (searchQuery.trim()) virtualizerRef.current.measure()
    }, [searchQuery])

    // ─── Streaming auto-scroll via ResizeObserver on last item ───────────────
    // Strategy: observe the last rendered message item with a ResizeObserver.
    // When its height changes (tokens arriving), scroll to bottom — but only
    // if the user hasn't scrolled away. This avoids observing the whole
    // container subtree (which causes oscillation with the virtualizer).
    //
    // We track the last item DOM node via a ref updated in render.
    const lastItemNodeRef = React.useRef<Element | null>(null)
    const streamingRoRef = React.useRef<ResizeObserver | null>(null)

    React.useEffect(() => {
      // Tear down previous observer whenever streamingMessageId changes
      if (streamingRoRef.current) {
        streamingRoRef.current.disconnect()
        streamingRoRef.current = null
      }

      if (!streamingMessageId) {
        userScrolledAwayRef.current = false
        return
      }

      // Reset user-scrolled-away when a new stream starts
      userScrolledAwayRef.current = false

      const el = scrollRef.current
      if (!el) return

      // Scroll to bottom immediately when streaming starts
      const scrollToBottom = () => {
        if (!autoScrollRef.current) return
        if (userScrolledAwayRef.current) return
        isProgrammaticScrollRef.current = true
        el.scrollTop = el.scrollHeight
        requestAnimationFrame(() => { isProgrammaticScrollRef.current = false })
      }

      scrollToBottom()

      // Create a ResizeObserver that fires when content grows
      const ro = new ResizeObserver(scrollToBottom)
      streamingRoRef.current = ro

      // Observe the last item node if it's already rendered
      if (lastItemNodeRef.current) ro.observe(lastItemNodeRef.current)

      return () => {
        ro.disconnect()
        streamingRoRef.current = null
      }
    }, [streamingMessageId])

    // ─── Visible user index tracking ─────────────────────────────────────────
    const callbackRef = React.useRef(onVisibleUserIndexChange)
    React.useLayoutEffect(() => { callbackRef.current = onVisibleUserIndexChange })

    React.useEffect(() => {
      const el = scrollRef.current
      if (!el || !onVisibleUserIndexChange) return

      const filteredToFull = new Map<number, number>()
      filteredMessages.forEach((msg, fi) => {
        const fullIdx = messages.findIndex((m) => m.id === msg.id)
        if (fullIdx !== -1) filteredToFull.set(fi, fullIdx)
      })
      const userFilteredIndices = filteredMessages
        .map((m, i) => m.role === 'user' ? i : -1)
        .filter(i => i !== -1)

      if (userFilteredIndices.length === 0) return

      let lastReported = -1
      const report = () => {
        const vItems = virtualizerRef.current.getVirtualItems()
        if (vItems.length === 0) return
        const scrollTop = el.scrollTop
        let topItem = vItems[0]
        for (const item of vItems) {
          if (item.start <= scrollTop) topItem = item
          else break
        }
        let best = userFilteredIndices[0]
        for (const ui of userFilteredIndices) {
          if (ui <= topItem.index) best = ui
          else break
        }
        const fullIdx = filteredToFull.get(best) ?? -1
        if (fullIdx !== -1 && fullIdx !== lastReported) {
          lastReported = fullIdx
          callbackRef.current?.(fullIdx)
        }
      }

      el.addEventListener('scroll', report, { passive: true })
      const t = setTimeout(report, 50)
      return () => { clearTimeout(t); el.removeEventListener('scroll', report) }
    }, [filteredMessages, messages, onVisibleUserIndexChange])

    // ─── Imperative handle ───────────────────────────────────────────────────
    React.useImperativeHandle(ref, () => ({
      scrollToMessage: (fullIndex: number) => {
        const targetId = messages[fullIndex]?.id
        if (!targetId) return
        const fi = filteredMessagesRef.current.findIndex((m) => m.id === targetId)
        if (fi === -1) return
        virtualizerRef.current.scrollToIndex(fi, { behavior: 'auto', align: 'start' })
      },

      scrollToBottom: () => {
        const el = scrollRef.current
        if (!el) return
        const lastIdx = filteredMessagesRef.current.length - 1
        if (lastIdx < 0) return
        // Step 1: use virtualizer to bring items into view
        virtualizerRef.current.scrollToIndex(lastIdx, { align: 'end', behavior: 'auto' })
        // Step 2: after layout, pin to true DOM bottom (handles estimate drift)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              isProgrammaticScrollRef.current = true
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight
              requestAnimationFrame(() => { isProgrammaticScrollRef.current = false })
            }
          })
        })
      },

      getScrollElement: () => scrollRef.current,

      getScrollToken: (): ScrollToken | null => {
        const el = scrollRef.current
        if (!el) return null
        const vItems = virtualizerRef.current.getVirtualItems()
        if (vItems.length === 0) return null
        const scrollTop = el.scrollTop
        let topItem = vItems[0]
        for (const item of vItems) {
          if (item.start <= scrollTop) topItem = item
          else break
        }
        const msg = filteredMessagesRef.current[topItem.index]
        if (!msg) return null
        return { messageId: msg.id, scrollTop }
      },

      getScrollPosition: () => scrollRef.current?.scrollTop ?? 0,

      onScroll: (cb: () => void) => {
        const el = scrollRef.current
        if (!el) return () => { }
        el.addEventListener('scroll', cb, { passive: true })
        return () => el.removeEventListener('scroll', cb)
      },
    }), [messages])

    // ─── Render ──────────────────────────────────────────────────────────────
    const virtualItems = virtualizer.getVirtualItems()
    const lastFilteredIdx = filteredMessages.length - 1

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
                const isLast = virtualItem.index === lastFilteredIdx
                return (
                  <div
                    key={message.id}
                    ref={(node) => {
                      virtualizer.measureElement(node)
                      if (isLast) {
                        if (node !== lastItemNodeRef.current) {
                          if (lastItemNodeRef.current && streamingRoRef.current) {
                            streamingRoRef.current.unobserve(lastItemNodeRef.current)
                          }
                          lastItemNodeRef.current = node
                          if (node && streamingRoRef.current) {
                            streamingRoRef.current.observe(node)
                          }
                        }
                      }
                    }}
                    data-index={virtualItem.index}
                    data-msg-id={message.id}
                    data-role={message.role}
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
