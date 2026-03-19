import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence, motion } from 'framer-motion'
import * as React from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { MessageData } from '@/lib/bindings'
import { MessageBubble } from './message-bubble'

export interface MessageThreadHandle {
  scrollToMessage: (index: number) => void
}

interface MessageThreadProps {
  messages: MessageData[]
  streamingMessageId?: string
  isLoading?: boolean
  /** Called with the nearest user-message index visible in the viewport. */
  onVisibleUserIndexChange?: (index: number) => void
  /** ID of the message that should be highlighted (for animation) */
  highlightedMessageId?: string | null
}

export const MessageThread = React.forwardRef<
  MessageThreadHandle,
  MessageThreadProps
>(
  (
    {
      messages,
      streamingMessageId,
      isLoading,
      onVisibleUserIndexChange,
      highlightedMessageId
    },
    ref
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    // When a programmatic scroll is in flight we suppress the scroll listener
    // so intermediate positions during the smooth animation don't overwrite
    // the intended target index.
    const isProgrammaticScroll = React.useRef(false)
    const programmaticScrollTimer = React.useRef<ReturnType<
      typeof setTimeout
    > | null>(null)

    const virtualizer = useVirtualizer({
      count: messages.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => 80,
      overscan: 5,
      measureElement: (el) => el.getBoundingClientRect().height
    })

    const virtualItems = virtualizer.getVirtualItems()

    // Auto-scroll to bottom on new messages
    React.useEffect(() => {
      if (messages.length === 0) return
      virtualizer.scrollToIndex(messages.length - 1, {
        behavior: streamingMessageId ? 'smooth' : 'auto'
      })
    }, [messages.length, streamingMessageId, virtualizer])

    React.useImperativeHandle(ref, () => ({
      scrollToMessage: (index: number) => {
        // Mark programmatic scroll as in-flight before triggering it.
        // Clear any previous timer so back-to-back clicks each get a full window.
        if (programmaticScrollTimer.current) {
          clearTimeout(programmaticScrollTimer.current)
        }
        isProgrammaticScroll.current = true

        // Immediately push the target index to the parent so the navigator
        // highlight jumps to the right pill without waiting for scroll to settle.
        callbackRef.current?.(index)

        virtualizer.scrollToIndex(index, {
          behavior: 'smooth',
          align: 'center'
        })

        // Re-enable the listener after the smooth scroll has had time to finish.
        // 600 ms comfortably covers a typical smooth-scroll duration.
        programmaticScrollTimer.current = setTimeout(() => {
          isProgrammaticScroll.current = false
          programmaticScrollTimer.current = null
        }, 600)
      }
    }))

    // Keep a stable ref to the callback so the scroll effect doesn't need to
    // re-subscribe on every render.
    const callbackRef = React.useRef(onVisibleUserIndexChange)
    React.useLayoutEffect(() => {
      callbackRef.current = onVisibleUserIndexChange
    })

    React.useEffect(() => {
      const el = scrollRef.current
      if (!el || !onVisibleUserIndexChange) return

      const report = () => {
        // Skip intermediate frames produced by programmatic smooth scrolls.
        if (isProgrammaticScroll.current) return

        const items = virtualizer.getVirtualItems()
        if (items.length === 0) return

        const scrollTop = el.scrollTop
        const clientHeight = el.clientHeight
        const scrollHeight = el.scrollHeight
        // Max reachable scrollTop — accounts for subpixel/fractional rounding
        // that makes scrollTop + clientHeight fall slightly short of scrollHeight.
        const maxScroll = scrollHeight - clientHeight

        // Pre-compute user indices once for boundary cases
        const userIndices = messages
          .map((m, i) => (m.role === 'user' ? i : -1))
          .filter((i) => i !== -1)
        if (userIndices.length === 0) return
        const firstUserIdx = userIndices[0]
        const lastUserIdx = userIndices[userIndices.length - 1]

        if (scrollTop <= 0) {
          callbackRef.current?.(firstUserIdx)
          return
        }
        if (maxScroll <= 0 || scrollTop >= maxScroll - 1) {
          callbackRef.current?.(lastUserIdx)
          return
        }

        const viewportMid = scrollTop + clientHeight / 2
        let closestIndex = items[0].index
        let closestDist = Infinity

        for (const item of items) {
          const dist = Math.abs(item.start + item.size / 2 - viewportMid)
          if (dist < closestDist) {
            closestDist = dist
            closestIndex = item.index
          }
        }

        const nearestUser = userIndices.reduce((best, ui) =>
          Math.abs(ui - closestIndex) < Math.abs(best - closestIndex)
            ? ui
            : best
        )
        callbackRef.current?.(nearestUser)
      }

      el.addEventListener('scroll', report, { passive: true })
      report()

      return () => {
        el.removeEventListener('scroll', report)
        if (programmaticScrollTimer.current) {
          clearTimeout(programmaticScrollTimer.current)
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [virtualizer, !!onVisibleUserIndexChange, messages.length])

    const showLoading = isLoading
    const showEmpty = !isLoading && messages.length === 0
    const showList = !isLoading && messages.length > 0

    return (
      <ScrollArea ref={scrollRef} className="h-full overflow-hidden">
        <AnimatePresence mode="sync">
          {showLoading && (
            <motion.div
              key="loading"
              className="flex items-center justify-center h-full text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Loading your conversation...</span>
              </div>
            </motion.div>
          )}
          {showEmpty && (
            <motion.div
              key="empty"
              className="flex flex-col items-center justify-center h-full text-center px-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <img
                src="/illustrations/empty-messages.svg"
                alt="Empty conversation"
                className="w-48 h-48 mb-4 opacity-90"
              />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                This conversation is empty
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Type a message below to begin your chat with the agent.
              </p>
            </motion.div>
          )}
          {showList && (
            <motion.div
              key="list"
              style={{
                height: virtualizer.getTotalSize(),
                position: 'relative'
              }}
            >
              {virtualItems.map((virtualItem) => {
                const message = messages[virtualItem.index]
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
                      transform: `translateY(${virtualItem.start}px)`
                    }}
                  >
                    <div className="px-4 py-1.5">
                      <MessageBubble
                        message={message}
                        isStreaming={message.id === streamingMessageId}
                        isHighlighted={message.id === highlightedMessageId}
                      />
                    </div>
                  </div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    )
  }
)

MessageThread.displayName = 'MessageThread'
