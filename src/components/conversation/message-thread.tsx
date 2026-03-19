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
      searchQuery = '',
      onVisibleUserIndexChange,
      highlightedMessageId
    },
    ref
  ) => {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    const filteredMessages = React.useMemo(() => {
      if (!searchQuery.trim()) return messages
      const lowerQuery = searchQuery.toLowerCase()
      return messages.filter(m =>
        m.content.toLowerCase().includes(lowerQuery)
      )
    }, [messages, searchQuery])

    // Reset scroll to top synchronously before paint whenever search query changes
    React.useLayoutEffect(() => {
      if (!scrollRef.current) return
      scrollRef.current.scrollTop = 0
    }, [searchQuery])

    const isProgrammaticScroll = React.useRef(false)
    const programmaticScrollTimer = React.useRef<ReturnType<
      typeof setTimeout
    > | null>(null)

    const virtualizer = useVirtualizer({
      count: filteredMessages.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => 80,
      overscan: 3, // reduced from 8 for better performance
      measureElement: (el) => el.getBoundingClientRect().height
    })

    const virtualItems = virtualizer.getVirtualItems()

    React.useEffect(() => {
      if (filteredMessages.length === 0 || searchQuery) return
      virtualizer.scrollToIndex(filteredMessages.length - 1, {
        behavior: streamingMessageId ? 'smooth' : 'auto'
      })
    }, [filteredMessages.length, streamingMessageId, virtualizer, searchQuery])

    React.useImperativeHandle(ref, () => ({
      scrollToMessage: (index: number) => {
        if (programmaticScrollTimer.current) {
          clearTimeout(programmaticScrollTimer.current)
        }
        isProgrammaticScroll.current = true
        callbackRef.current?.(index)

        virtualizer.scrollToIndex(index, {
          behavior: 'smooth',
          align: 'center'
        })

        programmaticScrollTimer.current = setTimeout(() => {
          isProgrammaticScroll.current = false
          programmaticScrollTimer.current = null
        }, 600)
      },
      scrollToIndex: (index, options) => {
        virtualizer.scrollToIndex(index, options)
      },
      getScrollPosition: () => scrollRef.current?.scrollTop ?? 0,
      scrollToPosition: (position: number) => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = position
        }
      },
      getTotalHeight: () => virtualizer.getTotalSize(),
      getClientHeight: () => scrollRef.current?.clientHeight ?? 0,
    }))

    const callbackRef = React.useRef(onVisibleUserIndexChange)
    React.useLayoutEffect(() => {
      callbackRef.current = onVisibleUserIndexChange
    })

    React.useEffect(() => {
      const el = scrollRef.current
      if (!el || !onVisibleUserIndexChange) return

      const report = () => {
        if (isProgrammaticScroll.current) return

        const items = virtualizer.getVirtualItems()
        if (items.length === 0) return

        const scrollTop = el.scrollTop
        const clientHeight = el.clientHeight
        const scrollHeight = el.scrollHeight
        const maxScroll = scrollHeight - clientHeight

        const userIndices = filteredMessages
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
    }, [virtualizer, filteredMessages, onVisibleUserIndexChange])

    const showLoading = isLoading
    const showEmpty = !isLoading && filteredMessages.length === 0
    const showList = !isLoading && filteredMessages.length > 0

    return (
      <div ref={scrollRef} className="h-full overflow-y-auto">
        {showLoading && (
          <motion.div
            key="loading"
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
        {showEmpty && (
          <motion.div
            key="empty"
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
              {searchQuery
                ? 'No matching messages'
                : 'This conversation is empty'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {searchQuery
                ? 'Try a different search term.'
                : 'Type a message below to begin your chat with the agent.'}
            </p>
          </motion.div>
        )}
        {showList && (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative'
            }}
          >
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
                    transform: `translateY(${virtualItem.start}px)`
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
