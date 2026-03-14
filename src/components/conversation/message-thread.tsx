import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ScrollArea } from '@/components/ui/scroll-area'  // import the unified component
import { MessageBubble } from './message-bubble'
import type { Message } from '@/lib/invoke'

interface MessageThreadProps {
  messages: Message[]
  streamingMessageId?: string
}

export function MessageThread({ messages, streamingMessageId }: MessageThreadProps) {
  // This ref now directly points to the Viewport inside ScrollArea
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 5,
    measureElement: el => el.getBoundingClientRect().height,
  })

  const virtualItems = virtualizer.getVirtualItems()

  React.useEffect(() => {
    if (messages.length === 0) return
    virtualizer.scrollToIndex(messages.length - 1, {
      behavior: streamingMessageId ? 'smooth' : 'auto',
    })
  }, [messages.length, streamingMessageId, virtualizer])

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Send a message to start the conversation.
      </div>
    )
  }

  return (
    <ScrollArea ref={scrollRef} className="h-full overflow-hidden">
      {/* Inner container sized to total virtual height */}
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualItems.map(virtualItem => {
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
                transform: `translateY(${virtualItem.start}px)`,
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
      </div>
    </ScrollArea>
  )
}
