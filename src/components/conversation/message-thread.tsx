import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence, motion } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './message-bubble'
import type { Message } from '@/lib/invoke'

interface MessageThreadProps {
  messages: Message[]
  streamingMessageId?: string
  isLoading?: boolean
}

export function MessageThread({
  messages,
  streamingMessageId,
  isLoading
}: MessageThreadProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 5,
    measureElement: (el) => el.getBoundingClientRect().height
  })

  const virtualItems = virtualizer.getVirtualItems()

  React.useEffect(() => {
    if (messages.length === 0) return
    virtualizer.scrollToIndex(messages.length - 1, {
      behavior: streamingMessageId ? 'smooth' : 'auto'
    })
  }, [messages.length, streamingMessageId, virtualizer])

  // Determine which content to show
  const showLoading = isLoading
  const showEmpty = !isLoading && messages.length === 0
  const showList = !isLoading && messages.length > 0

  return (
    <ScrollArea ref={scrollRef} className="h-full overflow-hidden">
      <AnimatePresence mode="wait">
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
            className="flex items-center justify-center h-full text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            Send a message to start the conversation.
          </motion.div>
        )}

        {showList && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
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
