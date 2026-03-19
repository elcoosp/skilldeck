// src/components/conversation/tool-call-card.tsx
/**
 * ToolCallCard — read-only display of a tool invocation and its result.
 * Shown inside assistant message bubbles after a tool round-trip completes.
 *
 * Features:
 * - Synthesized readable description of the tool call.
 * - Icons differentiated by tool category.
 * - Non-selectable collapsed header and input arguments (with copy button for result).
 * - Expandable detail view.
 */

import {
  ChevronDown,
  ChevronRight,
  FilePen,
  FileText,
  Globe,
  Search,
  Terminal,
  Wrench
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ToolCallCardProps {
  name: string
  arguments: Record<string, unknown>
  result?: string
  isError?: boolean
}

// Icons for different tool categories
const TOOL_ICONS: Record<string, React.ElementType> = {
  read_file: FileText,
  write_file: FilePen,
  run_shell: Terminal,
  execute_shell: Terminal,
  http_request: Globe,
  http_get: Globe,
  http_post: Globe,
  search: Search,
  web_search: Search,
  default: Wrench
}

// Human-readable description synthesizer
function synthesizeDescription(
  name: string,
  args: Record<string, unknown>
): string {
  const lowerName = name.toLowerCase()

  if (lowerName.includes('read_file') || lowerName.includes('readfile')) {
    const path = args.path ?? args.filename ?? args.file
    return `Read file: ${path}`
  }
  if (lowerName.includes('write_file') || lowerName.includes('writefile')) {
    const path = args.path ?? args.filename ?? args.file
    return `Write to: ${path}`
  }
  if (
    lowerName.includes('run_shell') ||
    lowerName.includes('exec') ||
    lowerName.includes('shell')
  ) {
    const cmd = args.command ?? args.cmd ?? ''
    return `Run: ${cmd}`
  }
  if (lowerName.includes('http_get') || lowerName.includes('fetch')) {
    const url = args.url ?? args.uri ?? ''
    return `GET: ${url}`
  }
  if (lowerName.includes('http_post')) {
    const url = args.url ?? args.uri ?? ''
    return `POST: ${url}`
  }
  if (lowerName.includes('search')) {
    const query = args.query ?? ''
    return `Search: ${query}`
  }
  // fallback
  return name
}

export function ToolCallCard({
  name,
  arguments: args,
  result,
  isError = false
}: ToolCallCardProps) {
  const [open, setOpen] = useState(false)
  const Icon = TOOL_ICONS[name] ?? TOOL_ICONS.default
  const description = synthesizeDescription(name, args)

  const copyResult = async () => {
    if (result) {
      await navigator.clipboard.writeText(result)
    }
  }

  return (
    <div
      className={cn(
        'my-1.5 rounded-lg border text-xs font-mono overflow-hidden select-none',
        isError
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-border bg-card'
      )}
    >
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/80 transition-colors select-none"
      >
        <Icon className="size-3 shrink-0 text-muted-foreground" />
        <span className="font-medium flex-1 truncate">{name}</span>
        <span className="text-xs text-muted-foreground/70 truncate max-w-[200px]">
          {description}
        </span>
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-border px-3 py-2 space-y-2 select-none">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Input
            </p>
            <pre className="whitespace-pre-wrap break-all text-[11px] select-none">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>

          {result !== undefined && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
                Output
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={copyResult}
                  className="h-5 px-2 text-[10px]"
                >
                  Copy
                </Button>
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
