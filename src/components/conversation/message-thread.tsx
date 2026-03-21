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
  isScrollingToMessage: () => boolean
}

interface MessageThreadProps {
  messages: MessageData[]
  conversationKey: string
  streamingMessageId?: string
  isLoading?: boolean
  searchQuery?: string
  highlightedMessageId?: string | null
  initialScrollToken?: ScrollToken | null
  autoScroll?: boolean
  onVisibleUserIndexChange?: (index: number) => void
  onScrollSettled?: (token: ScrollToken) => void
}

function distFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

// Survives conversation switches within the session
const globalMeasuredSizes = new Map<string, number>()

export const MessageThread = React.forwardRef<MessageThreadHandle, MessageThreadProps>(
  (
    {
      messages,
      conversationKey,
      streamingMessageId,
      isLoading,
      searchQuery = '',
      highlightedMessageId,
      initialScrollToken,
      autoScroll = true,
      onVisibleUserIndexChange,
      onScrollSettled,
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

    const measuredSizesRef = React.useRef(globalMeasuredSizes)
    const isProgrammaticScrollRef = React.useRef(false)
    const userScrolledAwayRef = React.useRef(false)
    const autoScrollRef = React.useRef(autoScroll)
    autoScrollRef.current = autoScroll
    const streamingRef = React.useRef(streamingMessageId)
    streamingRef.current = streamingMessageId
    const onScrollSettledRef = React.useRef(onScrollSettled)
    onScrollSettledRef.current = onScrollSettled

    // ─── Conversation switch ───────────────────────────────────────────────────
    const prevConversationKeyRef = React.useRef(conversationKey)
    const initialScrollTokenRef = React.useRef(initialScrollToken)
    const isSwitchingRef = React.useRef(false)   // true from render until layout effect runs

    if (prevConversationKeyRef.current !== conversationKey) {
      prevConversationKeyRef.current = conversationKey
      initialScrollTokenRef.current = initialScrollToken
      isSwitchingRef.current = true
    }

    // ─── Navigator scroll state ───────────────────────────────────────────────
    // scrollToMessage kicks off a rAF loop that polls until the target item
    // has a stable, non-collapsed position, then sets scrollTop directly.
    const navigatorActiveRef = React.useRef(false)

    // ─── Auto-scroll gate ─────────────────────────────────────────────────────
    // Blocks auto-scroll to bottom during switch/restoration/navigator scroll.
    // Simple boolean: true = auto-scroll allowed.
    const autoScrollReadyRef = React.useRef(false)

    // ─── scrollToFn ───────────────────────────────────────────────────────────
    const scrollToFn: React.ComponentProps<typeof useVirtualizer>['scrollToFn'] =
      React.useCallback((offset, { behavior }, instance) => {
        isProgrammaticScrollRef.current = true
        elementScroll(offset, { behavior }, instance)
        requestAnimationFrame(() => { isProgrammaticScrollRef.current = false })
      }, [])

    const avgAssistantHeightRef = React.useRef(400)
    const updateAvgAssistantHeight = React.useCallback((newHeight: number) => {
      avgAssistantHeightRef.current = Math.round(avgAssistantHeightRef.current * 0.7 + newHeight * 0.3)
    }, [])

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
      overscan: 5,
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
          if (role === 'assistant' && h > 80) updateAvgAssistantHeight(h)
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

        // ── Auto-scroll to bottom for new messages ─────────────────────────────
        // All guards are collapsed into one flag (autoScrollReadyRef) that is
        // set only after mount/switch setup is complete.
        if (!autoScrollRef.current) return
        if (streamingRef.current) return
        if (userScrolledAwayRef.current) return
        if (!autoScrollReadyRef.current) return
        if (navigatorActiveRef.current) return
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

    // ─── Scroll application helper ────────────────────────────────────────────
    // Polls until scrollHeight is large enough, then sets scrollTop once.
    // Used for both restoration and initial scroll-to-bottom.
    const applyScrollTop = React.useCallback((
      el: HTMLElement,
      savedScrollTop: number,
      onLanded: (actual: number) => void,
      maxAttempts = 60
    ) => {
      let attempts = 0
      const tryApply = () => {
        const maxScroll = el.scrollHeight - el.clientHeight
        if (maxScroll >= savedScrollTop || attempts >= maxAttempts) {
          const final = Math.min(savedScrollTop, Math.max(0, maxScroll))
          console.log(`[Restore] applying scrollTop=${final} attempts=${attempts} maxScroll=${maxScroll}`)
          isProgrammaticScrollRef.current = true
          el.scrollTop = final
          requestAnimationFrame(() => {
            isProgrammaticScrollRef.current = false
            // Confirm it actually landed (browser may clamp again if layout shifts)
            requestAnimationFrame(() => {
              onLanded(el.scrollTop)
            })
          })
        } else {
          attempts++
          requestAnimationFrame(tryApply)
        }
      }
      requestAnimationFrame(tryApply)
    }, [])

    // ─── Conversation switch handler ──────────────────────────────────────────
    React.useLayoutEffect(() => {
      if (!isSwitchingRef.current) return
      isSwitchingRef.current = false

      const el = scrollRef.current
      if (!el) return

      // Reset all state
      navigatorActiveRef.current = false
      autoScrollReadyRef.current = false
      userScrolledAwayRef.current = false

      const token = initialScrollTokenRef.current
      if (token?.scrollTop) {
        applyScrollTop(el, token.scrollTop, (actual) => {
          console.log(`[Restore] ✅ landed scrollTop=${actual}`)
          autoScrollReadyRef.current = false // stay blocked — user is mid-list
          if (onScrollSettledRef.current && token.messageId) {
            onScrollSettledRef.current({ messageId: token.messageId, scrollTop: actual })
          }
        })
      } else {
        // New conversation with no token — scroll to bottom
        const lastIdx = filteredMessagesRef.current.length - 1
        if (lastIdx >= 0) {
          virtualizerRef.current.scrollToIndex(lastIdx, { align: 'end', behavior: 'auto' })
        }
        autoScrollReadyRef.current = true
      }
    }) // runs every render, guarded by isSwitchingRef

    // ─── Mount handler ────────────────────────────────────────────────────────
    const didMountRef = React.useRef(false)
    React.useLayoutEffect(() => {
      if (didMountRef.current) return
      didMountRef.current = true

      const el = scrollRef.current
      if (!el) return

      const token = initialScrollTokenRef.current
      if (token?.scrollTop) {
        applyScrollTop(el, token.scrollTop, (actual) => {
          console.log(`[Restore] ✅ mount landed scrollTop=${actual}`)
          if (onScrollSettledRef.current && token.messageId) {
            onScrollSettledRef.current({ messageId: token.messageId, scrollTop: actual })
          }
        })
      } else {
        const lastIdx = filteredMessagesRef.current.length - 1
        if (lastIdx >= 0) {
          virtualizerRef.current.scrollToIndex(lastIdx, { align: 'end', behavior: 'auto' })
        }
        autoScrollReadyRef.current = true
      }
    }, [applyScrollTop])

    // ─── User scroll detection ────────────────────────────────────────────────
    React.useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      const onScroll = () => {
        if (isProgrammaticScrollRef.current) return
        if (navigatorActiveRef.current) {
          // User scrolled during navigator — cancel it
          navigatorActiveRef.current = false
          console.log(`[UserScroll] cancelled navigator scroll`)
        }
        const dist = distFromBottom(el)
        userScrolledAwayRef.current = dist > 100
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      return () => el.removeEventListener('scroll', onScroll)
    }, [])

    // ─── Search reset ─────────────────────────────────────────────────────────
    React.useLayoutEffect(() => {
      if (searchQuery.trim()) virtualizerRef.current.scrollToOffset(0, { behavior: 'auto' })
    }, [searchQuery])
    React.useEffect(() => {
      if (searchQuery.trim()) virtualizerRef.current.measure()
    }, [searchQuery])

    // ─── Streaming auto-scroll ────────────────────────────────────────────────
    const lastItemNodeRef = React.useRef<Element | null>(null)
    const streamingRoRef = React.useRef<ResizeObserver | null>(null)

    React.useEffect(() => {
      if (streamingRoRef.current) { streamingRoRef.current.disconnect(); streamingRoRef.current = null }
      if (!streamingMessageId) { userScrolledAwayRef.current = false; return }
      userScrolledAwayRef.current = false
      const el = scrollRef.current
      if (!el) return
      const scrollToBottom = () => {
        if (!autoScrollRef.current || userScrolledAwayRef.current) return
        isProgrammaticScrollRef.current = true
        el.scrollTop = el.scrollHeight
        requestAnimationFrame(() => { isProgrammaticScrollRef.current = false })
      }
      scrollToBottom()
      const ro = new ResizeObserver(scrollToBottom)
      streamingRoRef.current = ro
      if (lastItemNodeRef.current) ro.observe(lastItemNodeRef.current)
      return () => { ro.disconnect(); streamingRoRef.current = null }
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
        if (navigatorActiveRef.current) return
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
        const el = scrollRef.current
        if (!el) return
        const targetId = messages[fullIndex]?.id
        if (!targetId) return
        const fi = filteredMessagesRef.current.findIndex((m) => m.id === targetId)
        if (fi === -1) return

        navigatorActiveRef.current = true

        // Use scrollToIndex to get the virtualizer to render the target item,
        // then poll until the item's position is stable and apply scrollTop directly.
        virtualizerRef.current.scrollToIndex(fi, { align: 'start', behavior: 'auto' })

        let lastStart = -1
        let stableTicks = 0
        const poll = () => {
          if (!navigatorActiveRef.current) return // user cancelled
          const vItems = virtualizerRef.current.getVirtualItems()
          const targetItem = vItems.find(it => it.index === fi)
          if (!targetItem) {
            // Item not yet in render window — keep requesting
            virtualizerRef.current.scrollToIndex(fi, { align: 'start', behavior: 'auto' })
            requestAnimationFrame(poll)
            return
          }
          const start = targetItem.start
          if (Math.abs(start - lastStart) <= 2) {
            stableTicks++
          } else {
            stableTicks = 0
          }
          lastStart = start

          if (stableTicks >= 3) {
            // Position is stable — apply it
            console.log(`[Navigator] stable at start=${start} after ${stableTicks} ticks`)
            navigatorActiveRef.current = false
            isProgrammaticScrollRef.current = true
            el.scrollTop = start
            requestAnimationFrame(() => {
              isProgrammaticScrollRef.current = false
              // Save token
              if (onScrollSettledRef.current) {
                const msg = filteredMessagesRef.current[fi]
                if (msg) {
                  onScrollSettledRef.current({ messageId: msg.id, scrollTop: start })
                  console.log(`[Navigator] ✅ converged msgId=${msg.id.slice(0, 8)} scrollTop=${start}`)
                }
              }
            })
          } else {
            // Keep scrollToIndex to fight drift, keep polling
            virtualizerRef.current.scrollToIndex(fi, { align: 'start', behavior: 'auto' })
            requestAnimationFrame(poll)
          }
        }
        requestAnimationFrame(poll)
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
        if (navigatorActiveRef.current) return null
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

      isScrollingToMessage: () => navigatorActiveRef.current,
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
