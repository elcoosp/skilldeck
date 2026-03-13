/**
 * Virtualized message thread.
 *
 * Uses react-virtuoso so threads with thousands of messages maintain 60 fps
 * (ASR-PERF-002). `followOutput="smooth"` auto-scrolls to the bottom while
 * streaming and stops when the user scrolls up.
 */

import { Virtuoso } from 'react-virtuoso'
import { MessageBubble } from './message-bubble'
import type { Message } from '@/lib/invoke'

interface MessageThreadProps {
  messages: Message[]
}

export function MessageThread({ messages }: MessageThreadProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Send a message to start the conversation.
      </div>
    )
  }

  return (
    <Virtuoso
      data={messages}
      itemContent={(_index, message) => (
        <div className="px-4 py-1.5">
          <MessageBubble message={message} />
        </div>
      )}
      followOutput="smooth"
      alignToBottom
      className="h-full"
      initialTopMostItemIndex={messages.length - 1}
    />
  )
}
