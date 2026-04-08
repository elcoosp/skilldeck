// src/components/conversation/thinking-view.tsx
import { useState } from 'react'
import { BrainCircuit, ChevronDown, ChevronRight } from 'lucide-react'
import { MarkdownView } from '@/components/markdown-view'
import type { NodeDocument } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface ThinkingViewProps {
  document: NodeDocument | null
  messageId: string
  conversationId: string | null
  isStreaming?: boolean
}

export function ThinkingView({
  document,
  messageId,
  conversationId,
  isStreaming = false,
}: ThinkingViewProps) {
  // Auto-expand while streaming, collapse when done
  const [expanded, setExpanded] = useState(false)

  if (!document) return null

  // If the document has no meaningful content (empty stable + draft nodes), don't render
  const hasContent =
    document.stable_nodes.length > 0 || document.draft_nodes.length > 0
  if (!hasContent) return null

  // Auto-expand during streaming
  const effectiveExpanded = isStreaming ? true : expanded

  return (
    <div className="mb-2 rounded-md border border-border/50 bg-muted/30">
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1.5 px-3 py-2 text-xs transition-colors',
          'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={effectiveExpanded}
        aria-label={isStreaming ? 'Thinking in progress' : 'Toggle thought process'}
      >
        <BrainCircuit className="size-3.5 shrink-0" />
        <span className="font-medium">
          {isStreaming ? 'Thinking…' : 'Thought process'}
        </span>
        {isStreaming && (
          <span className="ml-1 inline-flex gap-0.5">
            <span className="size-1 rounded-full bg-current animate-pulse" />
            <span className="size-1 rounded-full bg-current animate-pulse [animation-delay:0.2s]" />
            <span className="size-1 rounded-full bg-current animate-pulse [animation-delay:0.4s]" />
          </span>
        )}
        <span className="ml-auto">
          {effectiveExpanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </span>
      </button>

      {effectiveExpanded && (
        <div className="border-t border-border/40 px-3 pb-3 pt-2">
          <MarkdownView
            document={document}
            messageId={messageId}
            conversationId={conversationId}
            isStreaming={isStreaming}
            className={cn(
              'text-muted-foreground/80',
              '[&_code]:bg-muted [&_pre]:bg-muted',
              // Suppress artifact cards and heading bookmark buttons
              // inside the thinking panel
              '[&_.artifact-card]:hidden [&_.heading-bookmark]:hidden'
            )}
          />
        </div>
      )}
    </div>
  )
}
