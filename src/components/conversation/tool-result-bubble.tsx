// src/components/conversation/tool-result-bubble.tsx

import { FileIcon, FolderIcon } from '@react-symbols/icons/utils'
import { sentenceCase } from 'change-case'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Terminal,
  Wrench
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface ToolResultBubbleProps {
  content: string
  toolName?: string
  isError?: boolean
}

// Detect content type for rendering
function detectContentType(text: string): 'filetree' | 'json' | 'text' {
  const lines = text.trim().split('\n')
  const treeLines = lines.filter(
    (l) => l.startsWith('[FILE]') || l.startsWith('[DIR]')
  )
  if (treeLines.length > 0 && treeLines.length >= lines.length * 0.5)
    return 'filetree'

  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      /* ignore */
    }
  }
  return 'text'
}

// File tree renderer
function FileTreeRenderer({ text }: { text: string }) {
  const entries = text
    .trim()
    .split('\n')
    .map((line) => {
      const isDir = line.startsWith('[DIR]')
      const name = line.replace(/^\[(FILE|DIR)\]\s*/, '')
      const depth = (name.match(/\//g) || []).length
      return {
        isDir,
        name: name.split('/').pop() ?? name,
        depth
      }
    })

  return (
    <div className="font-mono text-xs space-y-0.5">
      {entries.map((e) => (
        <div
          key={`${e.name}-${e.depth}`}
          className="flex items-center gap-1.5"
          style={{ paddingLeft: e.depth * 12 }}
        >
          {e.isDir ? (
            <FolderIcon
              folderName={e.name}
              width={12}
              height={12}
              className="shrink-0"
            />
          ) : (
            <FileIcon
              fileName={e.name}
              width={12}
              height={12}
              className="shrink-0"
            />
          )}
          <span
            className={
              e.isDir ? 'text-foreground font-medium' : 'text-muted-foreground'
            }
          >
            {e.name}
          </span>
        </div>
      ))}
    </div>
  )
}

// JSON renderer with expand/collapse
function JSONRenderer({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    return (
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
        {text}
      </pre>
    )
  }

  const lines = JSON.stringify(parsed, null, 2).split('\n')
  const visible = expanded ? lines : lines.slice(0, 20)

  return (
    <div className="relative">
      <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
        {visible.join('\n')}
        {!expanded && lines.length > 20 && '…'}
      </pre>
      {lines.length > 20 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary mt-1 hover:underline"
        >
          {expanded ? 'Show less' : `Show ${lines.length - 20} more lines`}
        </button>
      )}
    </div>
  )
}

// Plain text renderer (default)
function TextRenderer({ text }: { text: string }) {
  return (
    <pre className="whitespace-pre-wrap break-all text-[11px] text-muted-foreground font-mono">
      {text}
    </pre>
  )
}

export function ToolResultBubble({
  content,
  toolName,
  isError = false
}: ToolResultBubbleProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [copied, setCopied] = useState(false)

  const contentType = useMemo(() => detectContentType(content), [content])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Result copied to clipboard')
  }

  const toggleCollapsed = () => setCollapsed((prev) => !prev)

  // Icon based on tool name
  const getToolIcon = () => {
    if (!toolName)
      return <Wrench className="size-3 shrink-0 text-muted-foreground" />
    const name = toolName.toLowerCase()
    if (
      name.includes('run') ||
      name.includes('shell') ||
      name.includes('terminal')
    )
      return <Terminal className="size-3 shrink-0 text-muted-foreground" />
    if (name.includes('file'))
      return (
        <FileIcon
          fileName={toolName}
          width={12}
          height={12}
          className="shrink-0 text-muted-foreground"
        />
      )
    if (name.includes('dir'))
      return (
        <FolderIcon
          folderName={toolName}
          width={12}
          height={12}
          className="shrink-0 text-muted-foreground"
        />
      )
    return <Wrench className="size-3 shrink-0 text-muted-foreground" />
  }

  const displayName = toolName ? sentenceCase(toolName) : 'Tool result'

  return (
    <div
      className={cn(
        'my-1.5 rounded-lg border text-xs font-mono overflow-hidden select-none',
        isError
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-border bg-card'
      )}
    >
      {/* Header – now contains copy button on the right */}
      <div className="flex w-full items-center gap-2 px-3 py-2 text-left bg-card hover:bg-muted/80 transition-colors">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-2 flex-1"
        >
          <span className="flex items-center gap-1.5">
            {getToolIcon()}
            <span className="font-medium truncate">{displayName}</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
            {isError ? 'Error' : 'Result'}
          </span>
        </button>
        <div className="flex items-center gap-1">
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
            aria-label="Copy result"
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
          {/* Collapse/expand toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded content – no extra padding */}
      {!collapsed && (
        <div className="border-t border-border">
          <div className="max-h-80 overflow-auto thin-scrollbar px-3 py-2">
            {contentType === 'filetree' && <FileTreeRenderer text={content} />}
            {contentType === 'json' && <JSONRenderer text={content} />}
            {contentType === 'text' && <TextRenderer text={content} />}
          </div>
        </div>
      )}
    </div>
  )
}
