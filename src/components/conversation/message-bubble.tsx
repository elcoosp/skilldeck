/**
 * Individual message bubble — role-aware layout and content rendering.
 *
 * Renders markdown for assistant messages via react-markdown, plain text for
 * user messages, and a compact card for tool-role messages.
 */

import { AlertCircle, Bot, Loader2, User, Wrench } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { ToolApprovalCard } from './tool-approval-card'
import type { Message } from '@/lib/invoke'

interface MessageBubbleProps {
  message: Message
  /** When true, show a streaming cursor at the end of content. */
  isStreaming?: boolean
}

export function MessageBubble({
  message,
  isStreaming = false
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isTool = message.role === 'tool'
  const isSystem = message.role === 'system'

  // Streaming synthetic bubble (id = '__streaming__')
  const syntheticStreaming = message.id === '__streaming__'

  return (
    <div className={cn('flex gap-3 max-w-full', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 size-7 rounded-full flex items-center justify-center mt-0.5',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isSystem
              ? 'bg-destructive/20 text-destructive'
              : isTool
                ? 'bg-muted text-muted-foreground'
                : 'bg-muted text-foreground'
        )}
        aria-hidden
      >
        {isUser ? (
          <User className="size-3.5" />
        ) : isSystem ? (
          <AlertCircle className="size-3.5" />
        ) : isTool ? (
          <Wrench className="size-3.5" />
        ) : (
          <Bot className="size-3.5" />
        )}
      </div>

      {/* Content bubble */}
      <div
        className={cn('relative max-w-[78%] min-w-0', isUser && 'text-right')}
      >
        <div
          className={cn(
            'inline-block px-3.5 py-2.5 rounded-xl text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : isTool
                ? 'bg-muted/70 font-mono text-xs w-full rounded-tl-sm'
                : 'bg-muted rounded-tl-sm'
          )}
        >
          {isAssistant || syntheticStreaming ? (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-1 prose-headings:my-1">
              <ReactMarkdown>{message.content}</ReactMarkdown>
              {(isStreaming || syntheticStreaming) && (
                <span className="inline-block ml-0.5 align-middle">
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                </span>
              )}
            </div>
          ) : (
            <span className="whitespace-pre-wrap break-words">
              {message.content}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
