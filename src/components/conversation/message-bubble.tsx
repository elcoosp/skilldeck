import rehypeShiki from '@shikijs/rehype'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Loader2,
  User,
  Wrench
} from 'lucide-react'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownHooks } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createHighlighter } from 'shiki'
import { toast } from 'sonner'
import { ContextChip } from '@/components/chat/context-chip'
import { BouncingDots } from '@/components/ui/bouncing-dots'
import type { MessageData } from '@/lib/bindings'
import { rehypeLinkifyCodeUrls } from '@/lib/rehype-linkify-code'
import { cn, highlightText } from '@/lib/utils'
import { SubagentCard } from './subagent-card'
import { openUrl } from '@tauri-apps/plugin-opener'

interface MessageBubbleProps {
  message: MessageData
  isStreaming?: boolean
  isHighlighted?: boolean
  searchQuery?: string
}

// ─── Shiki singleton ─────────────────────────────────────────────────────────
// Top-level await: module won't finish loading until Shiki is ready.
// rehypePlugins is a stable module-level constant — no state, no re-renders.
const highlighter = await createHighlighter({
  themes: ['github-light', 'vitesse-dark'],
  langs: ['javascript', 'typescript', 'python', 'bash', 'json', 'tsx', 'jsx', 'css', 'html'],
})

const rehypePlugins = [
  [rehypeShiki, { highlighter, themes: { light: 'vitesse-light', dark: 'vitesse-dark' }, useBackground: false }],
  rehypeLinkifyCodeUrls,
]

// ─── CodePre ─────────────────────────────────────────────────────────────────
function CodePre({ children, ...props }: any) {
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)

  const extractText = (node: any): string => {
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (node?.props?.children) return extractText(node.props.children)
    return ''
  }

  const language = props['data-language'] ?? 'code'

  const copy = async () => {
    await navigator.clipboard.writeText(extractText(children).replace(/\n$/, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Code copied to clipboard')
  }

  return (
    <div className="my-3 rounded-lg border border-border flex flex-col text-xs font-mono">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted rounded-t-lg">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <motion.div animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
            <ChevronRight className="size-3.5" />
          </motion.div>
          <span>{language}</span>
        </button>
        <button
          type="button"
          onClick={copy}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <div
        className="overflow-hidden rounded-b-lg"
        style={{
          maxHeight: collapsed ? 0 : 384,
          transition: 'max-height 0.18s ease',
        }}
      >
        <div
          className="overflow-auto max-h-96 thin-scrollbar bg-card [&>pre]:!m-0 [&>pre]:!rounded-none [&>pre]:!border-none [&>pre]:p-3 [&>pre]:text-xs [&>pre]:leading-relaxed [&>pre]:!bg-transparent"
        >
          <pre
            {...props}
            style={{ ...props.style, color: 'var(--foreground)' }}
          >
            {children}
          </pre>
        </div>
      </div>
    </div>
  )
}

const remarkPlugins = [remarkGfm]

// ─── MessageBubble ────────────────────────────────────────────────────────────
export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming = false,
  isHighlighted = false,
  searchQuery = '',
}: MessageBubbleProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)
  const proseRef = useRef<HTMLDivElement>(null)

  // ─── Heading ID generation per message ─────────────────────────────────────
  // We use a counter that resets for each message because the same message is
  // never re-rendered with the same content (new message = new key). The counter
  // must be stable across the component's lifetime for this message, so we store
  // it in a ref. But because `markdownComponents` is memoized, the counter must
  // be defined inside the memo's factory and reset each time the message changes.
  // We'll create a ref that holds the current counter and increment it imperatively.
  const headingCounterRef = useRef(0)

  const markdownComponents = useMemo(() => {
    // Reset counter for this message (since the memo re-runs when dependencies change)
    headingCounterRef.current = 0

    const makeHeading = (level: number) => ({ children, ...props }: any) => {
      // Extract plain text from children (could be a mix of strings and React elements)
      const text = (typeof children === 'string' ? children
        : Array.isArray(children) ? children.map((c: any) => typeof c === 'string' ? c : '').join('')
          : ''
      ).trim()
      const id = `heading-${headingCounterRef.current++}-${text
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '')}`
      return React.createElement(`h${level}`, { id, ...props }, children)
    }

    return {
      h1: makeHeading(1),
      h2: makeHeading(2),
      h3: makeHeading(3),
      h4: makeHeading(4),
      pre: CodePre,
      a: ({ href, children }: any) => (
        <a
          href={href}
          onClick={async (e) => {
            e.preventDefault()
            if (href) {
              try { await openUrl(href) } catch (err) { console.error('Failed to open link:', err) }
            }
          }}
          className="cursor-pointer underline"
        >
          {children}
        </a>
      ),
      code: ({ node, className, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(className || '')
        const content = String(children)
        const isBlock = match || content.includes('\n')

        if (isBlock) {
          return <code className={className} {...props}>{children}</code>
        }

        return (
          <span
            role="button"
            tabIndex={0}
            onClick={async () => {
              await navigator.clipboard.writeText(content.replace(/\n$/, ''))
              toast.success('Code copied to clipboard')
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                await navigator.clipboard.writeText(content.replace(/\n$/, ''))
                toast.success('Code copied to clipboard')
              }
            }}
            className="inline-code cursor-pointer rounded bg-muted px-1 py-0.5 font-mono text-sm hover:bg-primary/20 transition-colors"
            title="Click to copy"
          >
            {children}
          </span>
        )
      },
      table: ({ children }: any) => (
        <div className="overflow-x-auto my-2">
          <table className="border-collapse border border-border text-xs">{children}</table>
        </div>
      ),
      th: ({ children }: any) => (
        <th className="border border-border bg-muted/50 px-2 py-1 text-left font-medium">{children}</th>
      ),
      td: ({ children }: any) => (
        <td className="border border-border px-2 py-1">{children}</td>
      ),
    }
  }, []) // stable ref is fine – message.id doesn't change, so counter is per message instance

  useEffect(() => {
    const container = proseRef.current
    if (!container) return

    const clearMarks = () => {
      if (!document.contains(container)) return
      container.querySelectorAll('mark[data-search]').forEach((mark) => {
        const parent = mark.parentNode
        if (!parent || !document.contains(parent)) return
        try {
          parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark)
          parent.normalize()
        } catch { /* node removed — ignore */ }
      })
    }

    if (!searchQuery?.trim() || !message.content) { clearMarks(); return }
    clearMarks()
    if (!document.contains(container)) return

    const escaped = searchQuery.replace(/[.*+?^${ }()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        let p = node.parentElement
        while (p && p !== container) {
          if (p.tagName === 'CODE' || p.tagName === 'PRE') return NodeFilter.FILTER_REJECT
          p = p.parentElement
        }
        return regex.test(node.textContent ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      },
    })

    const textNodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) textNodes.push(node as Text)

    for (const textNode of textNodes) {
      if (!textNode.parentNode || !document.contains(textNode)) continue
      const text = textNode.textContent ?? ''
      regex.lastIndex = 0
      const frag = document.createDocumentFragment()
      let last = 0
      let match: RegExpExecArray | null
      while ((match = regex.exec(text)) !== null) {
        if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)))
        const mark = document.createElement('mark')
        mark.setAttribute('data-search', '')
        mark.style.backgroundColor = 'var(--highlight-inline)'
        mark.style.color = 'inherit'
        mark.style.borderRadius = '2px'
        mark.style.padding = '0 2px'
        mark.textContent = match[0]
        frag.appendChild(mark)
        last = regex.lastIndex
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
      try { textNode.parentNode?.replaceChild(frag, textNode) } catch { /* ignore */ }
    }

    return clearMarks
  }, [searchQuery, message.content, rehypePlugins])

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isTool = message.role === 'tool'
  const isSystem = message.role === 'system'
  const syntheticStreaming = message.id === '__streaming__'
  const showShimmer = (isAssistant || syntheticStreaming) && isStreaming && !message.content

  const isQueued = useMemo(() => {
    if (!message.metadata) return false
    try {
      const meta = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata
      return meta.from_queue === true
    } catch { return false }
  }, [message.metadata])

  const contextItems = message.context_items || []
  const canCollapse = (isAssistant || isSystem || isTool) && !isStreaming && !syntheticStreaming
  const isCollapsed = collapsed && canCollapse
  const shouldHighlight = searchQuery && !showShimmer && message.content

  const copyMessage = useCallback(async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Message copied')
  }, [message.content])

  let subagentData: any = null
  if (isAssistant && !isStreaming && message.content) {
    try { subagentData = JSON.parse(message.content) } catch { /* ignore */ }
  }
  if (subagentData?.subagentId) {
    return <SubagentCard stepName={subagentData.task || 'Subagent'} status="running" onOpen={() => { }} />
  }

  return (
    <motion.div
      className={cn('flex gap-3 max-w-full', isUser && 'flex-row-reverse')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 size-7 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground mt-0.5'
            : isSystem ? 'bg-destructive/20 text-destructive mt-0.5'
              : isTool ? 'bg-muted text-muted-foreground mt-0.5'
                : 'bg-muted text-foreground mt-1.5'
        )}
        aria-hidden
      >
        {isUser ? <User className="size-3.5" />
          : isSystem ? <AlertCircle className="size-3.5" />
            : isTool ? <Wrench className="size-3.5" />
              : <Bot className="size-3.5" />}
      </div>

      {/* Message container */}
      <div className={cn('flex flex-col min-w-0', isUser ? 'items-end' : 'items-start', isAssistant ? 'w-full max-w-full' : 'max-w-[78%]')}>
        <div className={cn(isUser && 'text-right', 'w-full')}>
          <div
            data-message-id={message.id}
            className={cn(
              'relative px-3.5 py-2.5 rounded-xl text-sm leading-relaxed transition-colors duration-300',
              isUser ? 'bg-primary text-primary-foreground rounded-tr-sm inline-block'
                : isTool ? 'bg-muted/70 font-mono text-xs w-full rounded-tl-sm inline-block'
                  : showShimmer ? 'bg-muted/50 inline-block'
                    : isAssistant ? 'bg-transparent w-full inline-block'
                      : 'bg-muted/50 inline-block',
              isQueued && 'border-l-2 border-amber-400 pl-3'
            )}
          >
            {/* Highlight ring */}
            <motion.div
              className={cn(
                'absolute inset-0 ring-2 ring-primary/50 ring-offset-1 pointer-events-none',
                isUser ? 'rounded-xl rounded-tr-sm' : isTool ? 'rounded-xl rounded-tl-sm' : 'rounded-xl'
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: isHighlighted ? 1 : 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />

            {isQueued && (
              <span className="text-xs bg-primary-foreground/10 text-primary-foreground rounded-full px-2 py-0.5 mb-1 flex items-center gap-1 self-start">
                <Clock className="size-3" /> Queued
              </span>
            )}

            {contextItems.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {contextItems.map((item: any, idx: number) => (
                  <ContextChip key={item.path || item.name || `item-${idx}`} item={item} readonly />
                ))}
              </div>
            )}

            {canCollapse && (
              <div className="flex items-center gap-1 mb-1 text-muted-foreground">
                <span className="text-xs font-medium">
                  {isAssistant ? 'Assistant' : isSystem ? 'System' : 'Tool'}
                </span>
                <motion.button
                  type="button"
                  onClick={() => setCollapsed((v) => !v)}
                  className="p-0.5 hover:bg-muted-foreground/20 rounded transition-colors"
                  aria-label={isCollapsed ? 'Expand message' : 'Collapse message'}
                  whileTap={{ scale: 0.9 }}
                >
                  <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} transition={{ duration: 0.2 }}>
                    {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </motion.div>
                </motion.button>
              </div>
            )}

            <div
              className="overflow-hidden"
              style={{
                maxHeight: isCollapsed ? 0 : 99999,
                transition: 'max-height 0.18s ease',
                opacity: isCollapsed ? 0 : 1,
              }}
            >
              {isAssistant || syntheticStreaming ? (
                <div ref={proseRef} className="prose prose-sm dark:prose-invert max-w-none break-words prose-p:my-1 prose-headings:my-1 prose-pre:my-0">
                  {showShimmer ? (
                    <div className="flex items-center justify-center py-4"><BouncingDots /></div>
                  ) : (
                    <MarkdownHooks
                      remarkPlugins={remarkPlugins}
                      rehypePlugins={rehypePlugins}
                      components={markdownComponents}
                    >
                      {message.content}
                    </MarkdownHooks>
                  )}
                  {(isStreaming || syntheticStreaming) && message.content && (
                    <span className="inline-block ml-0.5 align-middle">
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    </span>
                  )}
                </div>
              ) : shouldHighlight ? (
                <span
                  className="whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ __html: highlightText(message.content, searchQuery) }}
                />
              ) : (
                <span className="whitespace-pre-wrap break-words">{message.content}</span>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {!isStreaming && !syntheticStreaming && message.content && !isCollapsed && (
            <motion.button
              key="copy-button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={copyMessage}
              className="mt-1 p-1 text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 shadow-none"
              aria-label="Copy message"
            >
              {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
})
