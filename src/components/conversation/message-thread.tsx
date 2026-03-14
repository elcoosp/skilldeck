/**
 * Message thread virtualised with @tanstack/react-virtual.
 *
 * We own the scroll container entirely — a plain div with overflow-y:auto
 * wrapped in a Radix ScrollArea for the custom scrollbar. No black-box scroll
 * management, no prop conflicts, no timing issues.
 *
 * Scroll-to-bottom behaviour:
 * - On mount: scrolls instantly to the last message.
 * - While streamingMessageId is set: scrolls to bottom on every render so the
 *   latest streaming content stays visible.
 * - After streaming ends: user can freely scroll up; we don't force anything.
 */

import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import { ScrollBar } from '@/components/ui/scroll-area'
import { MessageBubble } from './message-bubble'
import type { Message } from '@/lib/invoke'

interface MessageThreadProps {
  messages: Message[]
  streamingMessageId?: string
}

export function MessageThread({ messages, streamingMessageId }: MessageThreadProps) {
  // This is the actual scroll container — we ref it directly so TanStack
  // Virtual never has to guess or fight another scroll manager.
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    // Generous estimate — TanStack will measure and correct after first render.
    estimateSize: () => 80,
    // Keep 5 items rendered outside the viewport for smooth fade-ins.
    overscan: 5,
    // Use the actual rendered height for each item after mount.
    measureElement: el => el.getBoundingClientRect().height,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // Scroll to bottom on mount (instant) and whenever streaming is active.
  React.useEffect(() => {
    if (messages.length === 0) return
    virtualizer.scrollToIndex(messages.length - 1, {
      // Smooth only during streaming so new content follows naturally.
      // Instant on mount so we don't animate through the whole history.
      behavior: streamingMessageId ? 'smooth' : 'auto',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, streamingMessageId])

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Send a message to start the conversation.
      </div>
    )
  }

  return (
    // Radix ScrollArea wraps the scroll container purely for the custom scrollbar.
    // The actual overflow/scrolling is on the Viewport div below.
    <ScrollAreaPrimitive.Root className="relative h-full overflow-hidden">
      <ScrollAreaPrimitive.Viewport
        ref={scrollRef}
        className="size-full"
      >
        {/* Inner container sized to total virtual height — establishes scroll range */}
        <div
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {virtualItems.map(virtualItem => {
            const message = messages[virtualItem.index]
            return (
              <div
                key={message.id}
                // ref lets TanStack measure the real rendered height and correct estimates
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
      </ScrollAreaPrimitive.Viewport>

      <ScrollBar orientation="vertical" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}
