// src/components/conversation/tool-call-card.tsx
/**
 * ToolCallCard — read-only display of a tool invocation and its result.
 * Shown inside assistant message bubbles after a tool round-trip completes.
 */

import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ToolCallCardProps {
  name: string
  arguments: Record<string, unknown>
  result?: string
  isError?: boolean
}

export function ToolCallCard({
  name,
  arguments: args,
  result,
  isError = false
}: ToolCallCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'my-1.5 rounded-lg border text-xs font-mono overflow-hidden',
        isError
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-border bg-card'
      )}
    >
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/80 transition-colors"
      >
        <Wrench className="size-3 shrink-0 text-muted-foreground" />
        <span className="font-medium flex-1 truncate">{name}</span>
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Input
            </p>
            <pre className="whitespace-pre-wrap break-all text-[11px]">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>

          {result !== undefined && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Output
              </p>
              <pre
                className={cn(
                  'whitespace-pre-wrap break-all text-[11px]',
                  isError && 'text-destructive'
                )}
              >
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
