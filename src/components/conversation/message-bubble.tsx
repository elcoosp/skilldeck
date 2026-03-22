// src/components/conversation/message-bubble.tsx (corrected)
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
  Download,
  Loader2,
  MoreHorizontal,
  User,
  Wrench,
  Bookmark,
  BookmarkCheck
} from 'lucide-react'
import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownHooks } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import type { Highlighter } from 'shiki'
import { createHighlighter } from 'shiki'
import { toast } from 'sonner'
import { ContextChip } from '@/components/chat/context-chip'
import { BouncingDots } from '@/components/ui/bouncing-dots'
import type { MessageData } from '@/lib/bindings'
import { rehypeLinkifyCodeUrls } from '@/lib/rehype-linkify-code'
import { cn, highlightText } from '@/lib/utils'
import { SubagentCard } from './subagent-card'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollContainerContext } from './message-thread'
import { createPortal } from 'react-dom'
import { useBookmarksStore } from '@/store/bookmarks'
import { useUIStore } from '@/store/ui'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

interface MessageBubbleProps {
  message: MessageData
  isStreaming?: boolean
  isHighlighted?: boolean
  searchQuery?: string
  searchCaseSensitive?: boolean
  searchRegex?: boolean
}

// ─── Lazy Shiki highlighter singleton ─────────────────────────────────────────
let highlighterPromise: Promise<Highlighter> | null = null
const getHighlighter = () => {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'vitesse-dark'],
      langs: ['javascript', 'typescript', 'python', 'bash', 'json', 'tsx', 'jsx', 'css', 'html'],
    })
  }
  return highlighterPromise
}

// ─── Markdown components (stable, not re-created on each render) ─────────────
const remarkPlugins = [remarkGfm]
const rehypePlugins = [rehypeLinkifyCodeUrls, rehypeSlug] // rehypeShiki added dynamically

// ─── CodePre with floating header (unchanged) ────────────────────────────────
function CodePre({ children, ...props }: any) {
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)
  const isFloatingRef = useRef(false)

  const scrollContainer = useContext(ScrollContainerContext)

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

  useEffect(() => {
    const root = scrollContainer?.current
    const container = containerRef.current
    const header = headerRef.current
    const floating = floatingRef.current
    if (!root || !container || !header || !floating) return

    const sync = () => {
      if (collapsed) {
        floating.style.opacity = '0'
        floating.style.pointerEvents = 'none'
        header.style.visibility = 'visible'
        isFloatingRef.current = false
        return
      }

      const rootRect = root.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      const topGone = containerRect.top < rootRect.top
      const bottomVisible = containerRect.bottom > rootRect.top + 32

      if (topGone && bottomVisible) {
        floating.style.top = `${rootRect.top}px`
        floating.style.left = `${containerRect.left}px`
        floating.style.width = `${containerRect.width}px`
        floating.style.opacity = '1'
        floating.style.pointerEvents = 'auto'
        floating.style.borderRadius = '0'
        floating.style.boxShadow = '0 4px 12px 0 rgb(0 0 0 / 0.15)'
        header.style.visibility = 'hidden'
        isFloatingRef.current = true
      } else {
        floating.style.opacity = '0'
        floating.style.pointerEvents = 'none'
        floating.style.borderRadius = 'var(--radius)'
        floating.style.boxShadow = '0 0 0 0 transparent'
        header.style.visibility = 'visible'
        isFloatingRef.current = false
      }
    }

    root.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(container)
    sync()

    return () => {
      root.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [scrollContainer, collapsed])

  const headerContent = (
    <>
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
    </>
  )

  return (
    <>
      {createPortal(
        <div
          ref={floatingRef}
          className="fixed z-50 flex items-center justify-between px-3 py-1.5 border border-border bg-muted text-xs font-mono"
          style={{
            opacity: 0,
            pointerEvents: 'none',
            borderRadius: 'var(--radius)',
            boxShadow: '0 0 0 0 transparent',
            transition: 'opacity 300ms ease, border-radius 300ms ease, box-shadow 300ms ease',
          }}
        >
          {headerContent}
        </div>,
        document.body
      )}

      <div ref={containerRef} className="my-3 rounded-lg border border-border flex flex-col text-xs font-mono">
        <div
          ref={headerRef}
          className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted rounded-t-lg"
        >
          {headerContent}
        </div>

        <div
          className="overflow-hidden rounded-b-lg"
          style={{ maxHeight: collapsed ? 0 : 384, transition: 'max-height 0.18s ease' }}
        >
          <div className="overflow-auto max-h-96 thin-scrollbar bg-card [&>pre]:!m-0 [&>pre]:!rounded-none [&>pre]:!border-none [&>pre]:p-3 [&>pre]:text-xs [&>pre]:leading-relaxed [&>pre]:!bg-transparent">
            <pre {...props} style={{ ...props.style, color: 'var(--foreground)' }}>
              {children}
            </pre>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Assistant message actions (isolated to prevent re‑renders) ─────────────
const AssistantMessageActions = memo(function AssistantMessageActions({
  message,
  isBookmarked,
  onCopy,
  onDownload,
  onBookmark,
}: {
  message: MessageData
  isBookmarked: boolean
  onCopy: () => void
  onDownload: () => void
  onBookmark: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-0.5 hover:bg-muted-foreground/20 rounded transition-colors"
          aria-label="Message options"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={onCopy} className="cursor-pointer">
          <Copy className="mr-2 h-4 w-4" />
          <span>Copy</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4" />
          <span>Download</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onBookmark} className="cursor-pointer">
          {isBookmarked ? (
            <BookmarkCheck className="mr-2 h-4 w-4 text-amber-500" />
          ) : (
            <Bookmark className="mr-2 h-4 w-4" />
          )}
          <span>{isBookmarked ? 'Remove bookmark' : 'Bookmark'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

AssistantMessageActions.displayName = 'AssistantMessageActions'

// ─── MessageBubble ────────────────────────────────────────────────────────────
export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming = false,
  isHighlighted = false,
  searchQuery = '',
  searchCaseSensitive = false,
  searchRegex = false,
}: MessageBubbleProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)
  const proseRef = useRef<HTMLDivElement>(null)
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null)

  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const bookmarksMap = useBookmarksStore((s) => s.bookmarks)
  const bookmarks = useMemo(() => {
    if (!activeConversationId) return []
    const convBookmarks = bookmarksMap[activeConversationId]
    if (!convBookmarks) return []
    if (!Array.isArray(convBookmarks)) return []
    return convBookmarks.filter(b => b.message_id === message.id)
  }, [activeConversationId, bookmarksMap, message.id])
  const isBookmarked = bookmarks.length > 0

  // Load Shiki asynchronously
  useEffect(() => {
    getHighlighter().then(setHighlighter)
  }, [])

  // ─── Position‑based heading counter (resets when content changes) ─────────
  const headingIndexRef = useRef(0)
  const lastContentRef = useRef('')
  if (lastContentRef.current !== message.content) {
    lastContentRef.current = message.content
    headingIndexRef.current = 0
  }

  // ─── Markdown components with lazy Shiki ─────────────────────────────────
  const markdownComponents = useMemo(() => {
    const makeHeading = (level: number) => ({ children, node, ...props }: any) => {
      const text = (
        typeof children === 'string' ? children
          : Array.isArray(children)
            ? children.map((c: any) => (typeof c === 'string' ? c : '')).join('')
            : ''
      ).trim()

      const id = `h-${message.id}-${headingIndexRef.current++}`
      return React.createElement(`h${level}`, { id, ...props }, children)
    }

    // Only add rehypeShiki if highlighter is ready
    const finalRehypePlugins = [...rehypePlugins]
    if (highlighter) {
      finalRehypePlugins.unshift([
        rehypeShiki,
        { highlighter, themes: { light: 'vitesse-light', dark: 'vitesse-dark' }, useBackground: false },
      ])
    }

    return {
      h1: makeHeading(1),
      h2: makeHeading(2),
      h3: makeHeading(3),
      h4: makeHeading(4),
      h5: makeHeading(5),
      h6: makeHeading(6),
      pre: CodePre,
      a: ({ href, children, node, ...props }: any) => {
        if (href?.startsWith('#')) {
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                const targetId = href.slice(1)
                const container = document.getElementById(`msg-${message.id}`)
                const target = container?.querySelector(`#${targetId}`)
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth' })
                }
              }}
              className="cursor-pointer underline"
              {...props}
            >
              {children}
            </a>
          )
        }
        return (
          <a
            href={href}
            onClick={async (e) => {
              e.preventDefault()
              if (href) {
                try {
                  await openUrl(href)
                } catch (err) {
                  console.error('Failed to open link:', err)
                }
              }
            }}
            className="cursor-pointer underline"
            {...props}
          >
            {children}
          </a>
        )
      },
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
            {...props}
          >
            {children}
          </span>
        )
      },
      table: ({ children, node, ...props }: any) => (
        <div className="overflow-x-auto my-2" {...props}>
          <table className="border-collapse border border-border text-xs">
            {children}
          </table>
        </div>
      ),
      th: ({ children, node, ...props }: any) => (
        <th className="border border-border bg-muted/50 px-2 py-1 text-left font-medium" {...props}>
          {children}
        </th>
      ),
      td: ({ children, node, ...props }: any) => (
        <td className="border border-border px-2 py-1" {...props}>
          {children}
        </td>
      ),
    }
  }, [message.id, message.content, highlighter])

  // ─── Search highlighting effect ───────────────────────────────────────────
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

    let pattern = searchQuery
    if (!searchRegex) {
      pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    const flags = searchCaseSensitive ? 'g' : 'gi'
    let regex: RegExp
    try {
      regex = new RegExp(pattern, flags)
    } catch {
      return
    }

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
  }, [searchQuery, searchCaseSensitive, searchRegex, message.content])

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

  const downloadMessage = useCallback(async () => {
    const path = await save({
      defaultPath: `message_${message.id}.txt`,
      filters: [{ name: 'Text', extensions: ['txt', 'md'] }],
    })
    if (!path) return
    try {
      await writeTextFile(path, message.content)
      toast.success('Message saved')
    } catch (err) {
      toast.error(`Failed to save: ${err}`)
    }
  }, [message.id, message.content])

  const toggleBookmark = useCallback(() => {
    if (!activeConversationId) return
    useBookmarksStore.getState().toggleBookmark(activeConversationId, message.id, undefined, undefined)
  }, [activeConversationId, message.id])

  let subagentData: any = null
  if (isAssistant && !isStreaming && message.content) {
    try { subagentData = JSON.parse(message.content) } catch { /* ignore */ }
  }
  if (subagentData?.subagentId) {
    return <SubagentCard stepName={subagentData.task || 'Subagent'} status="running" onOpen={() => { }} />
  }

  return (
    <motion.div
      id={`msg-${message.id}`}
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
                'absolute inset-0 ring-2 ring-primary/50 pointer-events-none rounded-inherit', // removed ring-offset-1
                isUser ? 'rounded-xl rounded-tr-sm' : isTool ? 'rounded-xl rounded-tl-sm' : 'rounded-xl'
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: isHighlighted ? 1 : 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ willChange: 'opacity' }}
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

                {/* Dropdown menu for assistant messages */}
                {isAssistant && !isStreaming && !syntheticStreaming && (
                  <AssistantMessageActions
                    message={message}
                    isBookmarked={isBookmarked}
                    onCopy={copyMessage}
                    onDownload={downloadMessage}
                    onBookmark={toggleBookmark}
                  />
                )}
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
                      rehypePlugins={markdownComponents ? undefined : []} // actually we use our components, not plugins
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
                  dangerouslySetInnerHTML={{
                    __html: highlightText(message.content, searchQuery, {
                      caseSensitive: searchCaseSensitive,
                      isRegex: searchRegex,
                    }),
                  }}
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
