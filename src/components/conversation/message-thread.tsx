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
  getScrollPosition: () => number
  scrollToPosition: (position: number) => void
  getTotalHeight: () => number
  getClientHeight: () => number
}

export interface ScrollToken {
  index: number
  offsetWithinItem: number
  messageCount: number
}

interface MessageThreadProps {
  messages: MessageData[]
  streamingMessageId?: string
  isLoading?: boolean
  searchQuery?: string
  highlightedMessageId?: string | null
  initialScrollToken?: ScrollToken
  autoScroll?: boolean
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

    const filteredMessages = React.useMemo(() => {
      if (!searchQuery.trim()) return messages
      const q = searchQuery.toLowerCase()
      return messages.filter(m => m.content.toLowerCase().includes(q))
    }, [messages, searchQuery])

    const filteredMessagesRef = React.useRef(filteredMessages)
    filteredMessagesRef.current = filteredMessages

    const virtualizer = useVirtualizer({
      count: filteredMessages.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => 120,
      overscan: 5,
      measureElement: el => el.getBoundingClientRect().height,
    })

    const virtualizerRef = React.useRef(virtualizer)
    virtualizerRef.current = virtualizer

    const restorationDoneRef = React.useRef(false)

    React.useLayoutEffect(() => {
      if (restorationDoneRef.current) return
      if (filteredMessages.length === 0) return
      restorationDoneRef.current = true

      if (!initialScrollToken || initialScrollToken.messageCount === 0) {
        virtualizerRef.current.scrollToIndex(filteredMessages.length - 1, {
          align: 'end',
          behavior: 'auto',
        })
        return
      }

      const safeIndex = Math.min(initialScrollToken.index, filteredMessages.length - 1)

      virtualizerRef.current.scrollToIndex(safeIndex, {
        align: 'start',
        behavior: 'auto',
      })

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
    }, [filteredMessages.length > 0])

    React.useLayoutEffect(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }, [searchQuery])

    React.useEffect(() => {
      virtualizerRef.current.measure()
    }, [searchQuery])

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
      const el = scrollRef.current
      if (!el) return
      const onScroll = () => {
        if (!streamingMessageId) return
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        userScrolledUpRef.current = distanceFromBottom > 80
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      return () => el.removeEventListener('scroll', onScroll)
    }, [streamingMessageId])

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
    }), [])

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
            onScrollTo={(idx) => onNavigatorScrollTo?.(idx)}
          />
        )}
      </div>
    )
  }
)

MessageThread.displayName = 'MessageThread'
