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

// ─── Module-level measured size cache ────────────────────────────────────────
const globalMeasuredSizes = new Map<string, number>()

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

    // ─── Measured size cache (module-level) ──────────────────────────────────
    const measuredSizesRef = React.useRef(globalMeasuredSizes)

    // ─── Programmatic scroll tracking ────────────────────────────────────────
    const isProgrammaticScrollRef = React.useRef(false)

    // ─── User-away-from-bottom state ─────────────────────────────────────────
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

    // ─── Target for programmatic scroll to a specific message ────────────────
    // We store the filtered index we're trying to land on. On every onChange
    // tick we re-issue scrollToIndex so the virtualizer can converge as real
    // measurements arrive and correct its size estimates. Once the item's
    // virtual `start` equals scrollOffset (within tolerance) AND total size
    // has been stable for two consecutive ticks, we're done.
    const targetFilteredIndexRef = React.useRef<number | null>(null)
    const isProgrammaticScrollingRef = React.useRef(false)
    // Tracks getTotalSize() from the previous onChange tick so we can detect
    // when measurements have stopped landing and the layout has stabilised.
    const lastTotalSizeRef = React.useRef<number | null>(null)
    // Counts consecutive ticks where getTotalSize() hasn't changed, so we can
    // require N stable ticks before declaring convergence.
    const stableTotalTicksRef = React.useRef(0)

    // ─── scrollToFn: intercept ALL virtualizer scrolls ────────────────────────
    const scrollToFn: React.ComponentProps<typeof useVirtualizer>['scrollToFn'] =
      React.useCallback((offset, { behavior }, instance) => {
        isProgrammaticScrollRef.current = true
        elementScroll(offset, { behavior }, instance)
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false
        })
      }, [])

    // ─── Dynamic estimate based on measured average ──────────────────────────
    const avgAssistantHeightRef = React.useRef(400)

    const updateAvgAssistantHeight = React.useCallback((newHeight: number) => {
      avgAssistantHeightRef.current = Math.round(
        avgAssistantHeightRef.current * 0.7 + newHeight * 0.3
      )
    }, [])

    // Helper to determine if auto-scroll is allowed
    const shouldAutoScroll = () => {
      return autoScrollRef.current && !isProgrammaticScrollingRef.current
    }

    const virtualizer = useVirtualizer({
      count: filteredMessages.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: (index) => {
        const msg = filteredMessagesRef.current[index]
        if (!msg) return 80
        const known = measuredSizesRef.current.get(msg.id)
        if (known) return known
        return msg.role === 'assistant' ? avgAssistantHeightRef.current : 80
      },
      overscan: 5, // Keep reasonable overscan; no cheating
      useAnimationFrameWithResizeObserver: true,
      measureElement: (el) => {
        const h = el.getBoundingClientRect().height
        const msgId = (el as HTMLElement).dataset.msgId
        if (msgId) {
          const role = (el as HTMLElement).dataset.role ?? 'user'
          const prev = measuredSizesRef.current.get(msgId)
          const estimate = prev ?? (role === 'assistant' ? avgAssistantHeightRef.current : 80)
          const delta = h - estimate
          if (Math.abs(delta) > 50) {
            console.log(`[Measure] msgId=${msgId.slice(0, 8)} role=${role} estimated=${estimate} actual=${h} delta=${delta}`)
          }
          measuredSizesRef.current.set(msgId, h)
          if (role === 'assistant' && h > 80) {
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
              const targetItem = items.find(it => it.index === idx)
              const intraItemOffset = targetItem
                ? Math.max(0, token.scrollTop - targetItem.start)
                : 0
              console.log(`[Restoration] target=${idx} in range start=${targetItem?.start ?? '?'} savedScrollTop=${token.scrollTop} intraItem=${intraItemOffset}`)
              requestAnimationFrame(() => {
                instance.scrollToIndex(idx, { align: 'start', behavior: 'auto' })
                requestAnimationFrame(() => {
                  const el = instance.scrollElement as HTMLElement | null
                  if (el && intraItemOffset > 0) {
                    isProgrammaticScrollRef.current = true
                    el.scrollTop += intraItemOffset
                    requestAnimationFrame(() => { isProgrammaticScrollRef.current = false })
                  }
                })
              })
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

        // ── Phase 2: Converging programmatic scroll ───────────────────────────
        // scrollToIndex computes offsets from *estimated* sizes. As items render
        // and get measured, getTotalSize() shifts — sometimes by 100k+ px —
        // dragging the target's real position with it. We re-issue scrollToIndex
        // every tick so the virtualizer re-converges with fresh measurements.
        //
        // False-convergence traps:
        //   A. Size-collapse clamp: total shrinks mid-scroll, browser clamps
        //      scrollTop to the new max. The target's `start` can coincide with
        //      the clamped offset even though layout is still settling.
        //   B. Premature stability: total appears stable for one tick while
        //      still in a collapsed/wrong state before re-expansion starts.
        //
        // The only reliable signal that we are truly done:
        //   1. positionOk  — targetVItem.start ≈ scrollOffset
        //   2. The total has been stable for N consecutive ticks (not just 1)
        //   3. There is a minimum amount of content *after* the target,
        //      consistent with it genuinely being mid-list. If total is so small
        //      that the target is near the end, measurements are still settling.
        if (isProgrammaticScrollingRef.current && targetFilteredIndexRef.current !== null) {
          const targetIdx = targetFilteredIndexRef.current
          const targetVItem = items.find(it => it.index === targetIdx)
          const currentTotal = instance.getTotalSize()

          // Always re-drive. scrollToIndex is idempotent when aligned.
          instance.scrollToIndex(targetIdx, { align: 'start', behavior: 'auto' })

          if (targetVItem) {
            const scrollOffset = instance.scrollOffset ?? (el?.scrollTop ?? 0)
            const viewportHeight = el?.clientHeight ?? 0
            const positionOk = Math.abs(targetVItem.start - scrollOffset) <= 2

            // Stable-ticks counter: require the total to be unchanged for
            // STABLE_TICKS_REQUIRED consecutive ticks before we believe it.
            const STABLE_TICKS_REQUIRED = 2
            const prevTotal = lastTotalSizeRef.current
            const totalUnchanged = prevTotal !== null && Math.abs(currentTotal - prevTotal) < 10
            if (totalUnchanged) {
              stableTotalTicksRef.current += 1
            } else {
              stableTotalTicksRef.current = 0
            }
            const totalStable = stableTotalTicksRef.current >= STABLE_TICKS_REQUIRED

            // Content-after guard: the items after the target should add up to
            // more than one viewport worth of content. If total is tiny relative
            // to the target's start, we're still in a collapsed state.
            const itemsAfterTarget = filteredMessagesRef.current.length - 1 - targetIdx
            const minExpectedAfter = Math.max(viewportHeight, itemsAfterTarget * 80)
            const enoughContentAfter = (currentTotal - targetVItem.start - viewportHeight) > minExpectedAfter * 0.5

            if (positionOk && totalStable && enoughContentAfter) {
              console.log(`[ProgrammaticScroll] ✅ converged index=${targetIdx} start=${targetVItem.start} offset=${Math.round(scrollOffset)} total=${Math.round(currentTotal)}`)
              isProgrammaticScrollingRef.current = false
              targetFilteredIndexRef.current = null
              stableTotalTicksRef.current = 0
            } else {
              console.log(`[ProgrammaticScroll] ↻ index=${targetIdx} posOk=${positionOk} totalStable=${totalStable}(${stableTotalTicksRef.current}/${STABLE_TICKS_REQUIRED}) enoughAfter=${enoughContentAfter} total=${Math.round(currentTotal)} drift=${Math.round(targetVItem.start - scrollOffset)}`)
            }
          }

          lastTotalSizeRef.current = currentTotal
        } else {
          lastTotalSizeRef.current = instance.getTotalSize()
          stableTotalTicksRef.current = 0
        }

        // ── Phase 3: Auto-scroll (only when allowed) ─────────────────────────
        if (!shouldAutoScroll()) return
        if (streamingRef.current) return
        if (userScrolledAwayRef.current) return
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

    // ─── User scroll detection ────────────────────────────────────────────────
    React.useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      const onScroll = () => {
        if (isProgrammaticScrollRef.current) return
        const dist = distFromBottom(el)
        console.log(`[UserScroll] scrollTop=${Math.round(el.scrollTop)} dist=${Math.round(dist)} programmatic=${isProgrammaticScrollRef.current}`)
        userScrolledAwayRef.current = dist > 100
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      return () => el.removeEventListener('scroll', onScroll)
    }, [])

    // ─── Warm measurement cache on mount ─────────────────────────────────────
    React.useLayoutEffect(() => {
      virtualizerRef.current.measure()
    }, [])

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
    const lastItemNodeRef = React.useRef<Element | null>(null)
    const streamingRoRef = React.useRef<ResizeObserver | null>(null)

    React.useEffect(() => {
      if (streamingRoRef.current) {
        streamingRoRef.current.disconnect()
        streamingRoRef.current = null
      }

      if (!streamingMessageId) {
        userScrolledAwayRef.current = false
        return
      }

      userScrolledAwayRef.current = false

      const el = scrollRef.current
      if (!el) return

      const scrollToBottom = () => {
        if (!shouldAutoScroll()) return
        if (userScrolledAwayRef.current) return
        isProgrammaticScrollRef.current = true
        el.scrollTop = el.scrollHeight
        requestAnimationFrame(() => { isProgrammaticScrollRef.current = false })
      }

      scrollToBottom()

      const ro = new ResizeObserver(scrollToBottom)
      streamingRoRef.current = ro

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

        // Set up programmatic scroll tracking
        targetFilteredIndexRef.current = fi
        isProgrammaticScrollingRef.current = true

        // Scroll to the target using the virtualizer
        virtualizerRef.current.scrollToIndex(fi, { align: 'start', behavior: 'auto' })
      },

      scrollToBottom: () => {
        const el = scrollRef.current
        if (!el) return
        const lastIdx = filteredMessagesRef.current.length - 1
        if (lastIdx < 0) return
        virtualizerRef.current.scrollToIndex(lastIdx, { align: 'end', behavior: 'auto' })
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
