/**
 * MessageBubble — displays a single message with markdown rendering, syntax highlighting,
 * search highlighting, and bookmarking.
 */

import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import { getHighlighter } from '@/lib/highlighter'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Bot,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  MoreHorizontal,
  User,
  Wrench,
  GitBranch,
} from 'lucide-react'
import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownHooks } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import type { HighlighterCore } from 'shiki'
import { toast } from 'sonner'
import { ContextChip } from '@/components/chat/context-chip'
import type { MessageData } from '@/lib/bindings'
import { rehypeLinkifyCodeUrls } from '@/lib/rehype-linkify-code'
import { rehypeCodeMeta } from '@/lib/rehype-code-meta'
import { cn, highlightText } from '@/lib/utils'
import { SubagentCard } from './subagent-card'
import { ToolResultBubble } from './tool-result-bubble'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollContainerContext, AutoScrollContext } from './message-thread'
import { createPortal } from 'react-dom'
import { useBookmarksStore } from '@/store/bookmarks'
import { useConversationStore } from '@/store/conversation'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { CreateBranchModal } from './create-branch-modal'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface MessageBubbleProps {
  message: MessageData
  isStreaming?: boolean
  isHighlighted?: boolean
  searchQuery?: string
  searchCaseSensitive?: boolean
  searchRegex?: boolean
  onRetry?: () => void
  isBranchParent?: boolean
}

// ─── Stable plugin arrays (module-level, never recreated) ─────────────────────
const remarkPlugins = [remarkGfm]
const rehypePluginsBase = [rehypeLinkifyCodeUrls, rehypeSlug, rehypeCodeMeta]

// ─── Streaming context for code block auto‑scroll ──────────────────────────
const StreamingContext = React.createContext<boolean>(false)

// ─── Custom loading animation ──────────────────────────────────────────────────
const StreamingLoading = memo(() => (
  <div className="flex items-center gap-1.5 text-muted-foreground">
    <span className="size-1.5 rounded-full bg-current animate-pulse" />
    <span className="size-1.5 rounded-full bg-current animate-pulse [animation-delay:0.2s]" />
    <span className="size-1.5 rounded-full bg-current animate-pulse [animation-delay:0.4s]" />
  </div>
))
StreamingLoading.displayName = 'StreamingLoading'

// ─── CodePre with floating header + auto‑scroll during streaming ──────────
const CodePre = memo(({ children, ...props }: any) => {
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)
  const scrollableRef = useRef<HTMLDivElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const isFloatingRef = useRef(false)

  const scrollContainer = useContext(ScrollContainerContext)
  const autoScrollEnabled = useContext(AutoScrollContext)
  const isStreaming = useContext(StreamingContext)

  const isUserScrolledUp = useRef(false)
  const isProgrammaticScroll = useRef(false)

  const extractText = useCallback((node: any): string => {
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (node?.props?.children) return extractText(node.props.children)
    return ''
  }, [])

  const language = props['data-language'] ?? 'code'
  const filename = props['data-filename'] ?? null

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(extractText(children).replace(/\n$/, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Code copied to clipboard')
  }, [children, extractText])

  // ─── Scroll event detection ──────────────────────────────────────────────
  useEffect(() => {
    const scrollable = scrollableRef.current
    if (!scrollable) return

    const handleScroll = () => {
      if (isProgrammaticScroll.current) return
      const { scrollTop, scrollHeight, clientHeight } = scrollable
      isUserScrolledUp.current = Math.abs(scrollHeight - clientHeight - scrollTop) >= 10
    }

    scrollable.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollable.removeEventListener('scroll', handleScroll)
  }, [])

  // ─── Auto‑scroll via MutationObserver ───────────────────────────────────
  useEffect(() => {
    if (!isStreaming || !autoScrollEnabled || collapsed) return

    const scrollable = scrollableRef.current
    const pre = preRef.current
    if (!scrollable || !pre) return

    const scrollToBottom = () => {
      if (isUserScrolledUp.current) return
      isProgrammaticScroll.current = true
      scrollable.scrollTop = scrollable.scrollHeight
      requestAnimationFrame(() => { isProgrammaticScroll.current = false })
    }

    const observer = new MutationObserver(scrollToBottom)
    observer.observe(pre, { childList: true, subtree: true, characterData: true })
    scrollToBottom()

    return () => observer.disconnect()
  }, [isStreaming, autoScrollEnabled, collapsed])

  // ─── Floating header logic ─────────────────────────────────────────────
  useEffect(() => {
    const root = scrollContainer?.current
    const container = containerRef.current
    const header = headerRef.current
    const floating = floatingRef.current
    const scrollable = scrollableRef.current
    if (!root || !container || !header || !floating || !scrollable) return

    const hide = () => {
      floating.style.opacity = '0'
      floating.style.pointerEvents = 'none'
      header.style.visibility = 'visible'
      isFloatingRef.current = false
    }

    const sync = () => {
      const codeOverflows = scrollable.scrollHeight > scrollable.clientHeight
      if (collapsed || !codeOverflows) {
        hide()
        return
      }

      const rootRect = root.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      if (rootRect.width === 0 || rootRect.height === 0) {
        hide()
        return
      }

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
        hide()
      }
    }

    let rafId = 0
    const syncRaf = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(sync)
    }

    root.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(syncRaf)
    ro.observe(container)
    ro.observe(scrollable)
    rafId = requestAnimationFrame(sync)

    return () => {
      root.removeEventListener('scroll', sync)
      ro.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [scrollContainer, collapsed])

  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), [])

  const displayLabel = filename || language || 'code'

  const headerContent = (
    <>
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={collapsed ? 'Expand' : 'Collapse'}
      >
        <motion.div animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
          <ChevronRight className="size-3.5" />
        </motion.div>
        <span>{displayLabel}</span>
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
            transition: 'border-radius 200ms ease, box-shadow 200ms ease',
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
          <div
            ref={scrollableRef}
            className="overflow-auto max-h-96 thin-scrollbar bg-card [&>pre]:!m-0 [&>pre]:!rounded-none [&>pre]:!border-none [&>pre]:p-3 [&>pre]:text-xs [&>pre]:leading-relaxed [&>pre]:!bg-transparent"
          >
            <pre ref={preRef} {...props} style={{ ...props.style, color: 'var(--foreground)' }}>
              {children}
            </pre>
          </div>
        </div>
      </div>
    </>
  )
}
  , (prevProps, nextProps) => {
    // Only re-render if the children content or the collapsed state changed
    // (props like data-language etc. are assumed stable)
    return prevProps.children === nextProps.children && prevProps.collapsed === nextProps.collapsed
  })
// ─── Assistant message actions (with branch) ─────────────────────────────────
const AssistantMessageActions = memo(function AssistantMessageActions({
  message,
  conversationId,
  onCopy,
  onDownload,
  onBranch,
}: {
  message: MessageData
  conversationId: string | null
  onCopy: () => void
  onDownload: () => void
  onBranch: () => void
}) {
  const selectorFn = useCallback(
    (s: any) => {
      if (!conversationId) return false
      const convBookmarks = s.bookmarks[conversationId]
      if (!convBookmarks || !Array.isArray(convBookmarks)) return false
      return convBookmarks.some((b: any) => b.message_id === message.id && !b.heading_anchor)
    },
    [conversationId, message.id]
  )

  const isBookmarked = useBookmarksStore(selectorFn)

  const onBookmark = useCallback(() => {
    if (!conversationId) return
    useBookmarksStore.getState().toggleBookmark(conversationId, message.id, undefined, 'Message')
  }, [conversationId, message.id])

  return (
    <DropdownMenu modal={false}>
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
        <DropdownMenuItem
          onClick={onCopy}
          className="cursor-pointer hover:bg-primary/10 hover:text-foreground focus:bg-primary/10 focus:text-foreground"
        >
          <Copy className="mr-2 h-4 w-4" />
          <span>Copy</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDownload}
          className="cursor-pointer hover:bg-primary/10 hover:text-foreground focus:bg-primary/10 focus:text-foreground"
        >
          <Download className="mr-2 h-4 w-4" />
          <span>Download</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onBranch}
          className="cursor-pointer hover:bg-primary/10 hover:text-foreground focus:bg-primary/10 focus:text-foreground"
        >
          <GitBranch className="mr-2 h-4 w-4" />
          <span>Branch from here</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onBookmark}
          className="cursor-pointer hover:bg-primary/10 hover:text-foreground focus:bg-primary/10 focus:text-foreground"
        >
          {isBookmarked ? (
            <BookmarkCheck className="mr-2 h-4 w-4 text-amber-400 fill-amber-400" />
          ) : (
            <Bookmark className="mr-2 h-4 w-4 text-amber-400/70" />
          )}
          <span>{isBookmarked ? 'Remove bookmark' : 'Bookmark'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
AssistantMessageActions.displayName = 'AssistantMessageActions'

function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('')
  if (React.isValidElement(children)) {
    return extractTextFromChildren((children.props as any).children)
  }
  return ''
}

// ─── Heading bookmark button ──────────────────────────────────────────────────
const HeadingBookmarkButton = memo(function HeadingBookmarkButton({
  messageId,
  headingAnchor,
  headingLabel,
  conversationId,
}: {
  messageId: string
  headingAnchor: string
  headingLabel: string
  conversationId: string | null
}) {
  const isBookmarked = useBookmarksStore(
    useCallback(
      (s) => {
        if (!conversationId) return false
        const convBookmarks = s.bookmarks[conversationId]
        if (!convBookmarks || !Array.isArray(convBookmarks)) return false
        return convBookmarks.some(
          (b) => b.message_id === messageId && b.heading_anchor === headingAnchor
        )
      },
      [conversationId, messageId, headingAnchor]
    )
  )

  const toggle = useCallback(() => {
    if (!conversationId) return
    useBookmarksStore.getState().toggleBookmark(conversationId, messageId, headingAnchor, headingLabel)
  }, [conversationId, messageId, headingAnchor, headingLabel])

  return (
    <motion.button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle() }}
      className={cn(
        'ml-1.5 p-0.5 rounded hover:bg-muted-foreground/10 align-middle inline-flex items-center transition-opacity',
        isBookmarked ? 'opacity-100' : 'opacity-0 group-hover/heading:opacity-100'
      )}
      aria-label={isBookmarked ? 'Remove heading bookmark' : 'Bookmark this heading'}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.1 }}
    >
      <Bookmark
        className={cn(
          'size-3 transition-colors duration-150',
          isBookmarked ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'
        )}
      />
    </motion.button>
  )
})

// ─── Stable inline-code component (module-level, no closure deps) ─────────────
const InlineCode = memo(function InlineCode({ children, ...props }: any) {
  const content = String(children)
  const handleClick = useCallback(async () => {
    await navigator.clipboard.writeText(content.replace(/\n$/, ''))
    toast.success('Code copied to clipboard')
  }, [content])
  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      await navigator.clipboard.writeText(content.replace(/\n$/, ''))
      toast.success('Code copied to clipboard')
    }
  }, [content])

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="inline-code cursor-pointer rounded bg-muted px-1 py-0.5 font-mono text-sm hover:bg-primary/20 transition-colors"
      title="Click to copy"
      {...props}
    >
      {children}
    </span>
  )
})

// Stable table components (module-level)
const TableWrapper = memo(({ children, node, ...props }: any) => (
  <div className="overflow-x-auto my-2" {...props}>
    <table className="border-collapse border border-border text-xs">{children} </table>
  </div>
))
TableWrapper.displayName = 'TableWrapper'

const Th = memo(({ children, node, ...props }: any) => (
  <th className="border border-border bg-muted/50 px-2 py-1 text-left font-medium" {...props}>
    {children}
  </th>
))
Th.displayName = 'Th'

const Td = memo(({ children, node, ...props }: any) => (
  <td className="border border-border px-2 py-1" {...props}>
    {children}
  </td>
))
Td.displayName = 'Td'

// ─── Shared rehype plugins cache keyed by highlighter instance ───────────────
const rehypePluginsCache = new WeakMap<HighlighterCore, any[]>()

function getRehypePlugins(highlighter: HighlighterCore | null) {
  if (!highlighter) return rehypePluginsBase
  let cached = rehypePluginsCache.get(highlighter)
  if (!cached) {
    cached = [
      [rehypeShikiFromHighlighter, highlighter, {
        theme: 'github-light',            // You can also use dual themes if needed
        // themes: { light: 'github-light', dark: 'vitesse-dark' },
        defaultLanguage: 'text',
        lazy: false,                      // Crucial: disable on‑demand loading
        addLanguageClass: true,
        mergeSameStyleTokens: true,
      }],
      ...rehypePluginsBase,
    ]
    rehypePluginsCache.set(highlighter, cached)
  }
  return cached
}

// ─── Hook: build markdown components, stable across streaming ─────────────────
function useMarkdownComponents(
  messageId: string,
  activeConversationId: string | null,
  scrollContainer: React.RefObject<HTMLElement | null> | null,
  headingIndexRef: React.MutableRefObject<number>
) {
  const MarkdownLink = useCallback(
    ({ href, children, ...props }: any) => {
      if (href?.startsWith('#')) {
        const targetId = href.slice(1)
        const handleClick = (e: React.MouseEvent) => {
          e.preventDefault()
          setTimeout(() => {
            const target = document.getElementById(targetId)
            if (!target) return
            const container = scrollContainer?.current
            if (container) {
              const containerRect = container.getBoundingClientRect()
              const targetRect = target.getBoundingClientRect()
              const offset = targetRect.top - containerRect.top + container.scrollTop
              container.scrollTo({ top: offset - 16, behavior: 'smooth' })
            } else {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }, 10)
        }
        return (
          <a href={href} onClick={handleClick} className="cursor-pointer underline" {...props}>
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
              try { await openUrl(href) } catch (err) { console.error('Failed to open link:', err) }
            }
          }}
          className="cursor-pointer underline"
          {...props}
        >
          {children}
        </a>
      )
    },
    [scrollContainer]
  )

  return useMemo(() => {
    const makeHeading = (level: number) =>
      ({ children, node, ...props }: any) => {
        const idx = headingIndexRef.current++
        const headingAnchor = props.id || `heading-${messageId}-${idx}`
        const headingLabel = extractTextFromChildren(children).trim() || `Heading ${idx + 1}`

        return React.createElement(
          `h${level}`,
          { ...props, className: cn(props.className, 'group/heading flex items-center') },
          children,
          React.createElement(HeadingBookmarkButton, {
            key: `hbm-${idx}`,
            messageId,
            headingAnchor,
            headingLabel,
            conversationId: activeConversationId,
          })
        )
      }

    return {
      h1: makeHeading(1),
      h2: makeHeading(2),
      h3: makeHeading(3),
      h4: makeHeading(4),
      h5: makeHeading(5),
      h6: makeHeading(6),
      pre: CodePre,
      a: MarkdownLink,
      code: ({ node, className, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(className || '')
        const content = String(children)
        const isBlock = match || content.includes('\n')
        if (isBlock) return <code className={className} {...props}>{children}</code>
        return <InlineCode {...props}>{children}</InlineCode>
      },
      table: TableWrapper,
      th: Th,
      td: Td,
    }
  }, [messageId, activeConversationId, MarkdownLink, headingIndexRef])
}

// ─── MemoizedMarkdown ─────────────────────────────────────────────────────────
const MemoizedMarkdown = React.memo(function MemoizedMarkdown({
  children,
  remarkPlugins,
  rehypePlugins,
  components,
}: {
  children: string
  remarkPlugins: any[]
  rehypePlugins: any[]
  components: any
}) {
  return (
    <MarkdownHooks
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {children}
    </MarkdownHooks>
  )
}, (prev, next) =>
  prev.children === next.children &&
  prev.rehypePlugins === next.rehypePlugins &&
  prev.components === next.components
)

// ─── CollapsibleContent ───────────────────────────────────────────────────────
export interface CollapsibleHandle {
  collapse: () => void
  expand: () => void
  isCollapsed: () => boolean
}

const CollapsibleContent = React.forwardRef<
  CollapsibleHandle,
  { initialCollapsed?: boolean; messageId: string; children: React.ReactNode }
>(function CollapsibleContent({ initialCollapsed = false, messageId, children }, ref) {
  const outerRef = useRef<HTMLDivElement>(null)
  const collapsedRef = useRef(initialCollapsed)

  React.useImperativeHandle(ref, () => ({
    collapse() {
      const el = outerRef.current
      if (!el || collapsedRef.current) return
      collapsedRef.current = true
      const currentHeight = el.scrollHeight
      el.style.maxHeight = `${currentHeight}px`
      el.style.overflow = 'hidden'
      el.getBoundingClientRect()
      el.style.transition = 'max-height 0.18s ease, opacity 0.18s ease'
      el.style.maxHeight = '0px'
      el.style.opacity = '0'
    },
    expand() {
      const el = outerRef.current
      if (!el || !collapsedRef.current) return
      collapsedRef.current = false

      const doExpand = () => {
        if (!outerRef.current) return
        const targetHeight = outerRef.current.scrollHeight
        if (targetHeight === 0) {
          requestAnimationFrame(doExpand)
          return
        }
        const el2 = outerRef.current
        el2.style.transition = 'max-height 0.18s ease, opacity 0.18s ease'
        el2.style.maxHeight = `${targetHeight}px`
        el2.style.opacity = '1'
        const onEnd = () => {
          if (outerRef.current && !collapsedRef.current) {
            outerRef.current.style.maxHeight = 'none'
            outerRef.current.style.overflow = 'visible'
            outerRef.current.style.transition = ''
          }
          el2.removeEventListener('transitionend', onEnd)
        }
        el2.addEventListener('transitionend', onEnd)
      }
      doExpand()
    },
    isCollapsed: () => collapsedRef.current,
  }), [messageId])

  return (
    <div
      ref={outerRef}
      style={{
        overflow: initialCollapsed ? 'hidden' : 'visible',
        maxHeight: initialCollapsed ? '0px' : 'none',
        opacity: initialCollapsed ? 0 : 1,
      }}
    >
      {children}
    </div>
  )
})

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubbleInner({
  message,
  isStreaming = false,
  isHighlighted = false,
  searchQuery = '',
  searchCaseSensitive = false,
  searchRegex = false,
  onRetry,
  isBranchParent = false,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [branchModalOpen, setBranchModalOpen] = useState(false)
  const proseRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null)

  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const scrollContainer = useContext(ScrollContainerContext)

  const isBookmarked = useBookmarksStore(
    useCallback(
      (s) => {
        if (!activeConversationId) return false
        const convBookmarks = s.bookmarks[activeConversationId]
        if (!convBookmarks || !Array.isArray(convBookmarks)) return false
        return convBookmarks.some((b) => b.message_id === message.id)
      },
      [activeConversationId, message.id]
    )
  )

  const handleBranch = useCallback(() => {
    setBranchModalOpen(true)
  }, [])

  useEffect(() => {
    getHighlighter().then(setHighlighter)
  }, [])

  const headingIndexRef = useRef(0)
  const lastMessageIdRef = useRef('')
  if (lastMessageIdRef.current !== message.id) {
    lastMessageIdRef.current = message.id
    headingIndexRef.current = 0
  }
  const lastContentLenRef = useRef(0)
  if (isStreaming) {
    if (message.content.length < lastContentLenRef.current) {
      headingIndexRef.current = 0
    }
    lastContentLenRef.current = message.content.length
  }

  // ─── Memoize rehypePlugins so they are stable ─────────────────────────────
  const rehypePlugins = useMemo(() => {
    return getRehypePlugins(highlighter)
  }, [highlighter])

  const markdownComponents = useMarkdownComponents(
    message.id,
    activeConversationId,
    scrollContainer,
    headingIndexRef
  )

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isTool = message.role === 'tool'
  const isSystem = message.role === 'system'
  const syntheticStreaming = message.id === '__streaming__'

  // Search highlighting effect (unchanged)
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const clearMarks = () => {
      if (!document.contains(container)) return
      container.querySelectorAll('mark[data-search]').forEach((mark) => {
        const parent = mark.parentNode
        if (!parent || !document.contains(parent)) return
        try {
          parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark)
          parent.normalize()
        } catch { /* node removed */ }
      })
    }

    if (!searchQuery?.trim() || !message.content) { clearMarks(); return }
    clearMarks()
    if (!document.contains(container)) return

    let pattern = searchQuery
    if (!searchRegex) pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const flags = searchCaseSensitive ? 'g' : 'gi'
    let regex: RegExp
    try { regex = new RegExp(pattern, flags) } catch { return }

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
        mark.style.backgroundColor = isUser
          ? 'var(--highlight-inline-user, rgba(255,255,255,0.35))'
          : 'var(--highlight-inline, rgba(250,204,21,0.4))'
        mark.style.color = 'inherit'
        mark.style.borderRadius = '2px'
        mark.textContent = match[0]
        frag.appendChild(mark)
        last = regex.lastIndex
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
      try { textNode.parentNode?.replaceChild(frag, textNode) } catch { /* ignore */ }
    }

    return clearMarks
  }, [searchQuery, searchCaseSensitive, searchRegex, message.content, isUser])

  const showShimmer = (isAssistant || syntheticStreaming) && isStreaming && !message.content

  const isQueued = useMemo(() => {
    if (!message.metadata) return false
    try {
      const meta = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata
      return meta.from_queue === true
    } catch { return false }
  }, [message.metadata])

  const contextItems = message.context_items || []
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

  const collapsibleRef = useRef<CollapsibleHandle>(null)
  const collapsedStateRef = useRef(false)
  const [, forceUpdate] = useState(0)
  const isCollapsed = collapsedStateRef.current
  const canCollapse = (isAssistant || isSystem || isTool) && !isStreaming && !syntheticStreaming

  const toggleCollapsed = useCallback(() => {
    const handle = collapsibleRef.current
    if (!handle) return
    if (handle.isCollapsed()) {
      handle.expand()
      collapsedStateRef.current = false
    } else {
      handle.collapse()
      collapsedStateRef.current = true
    }
    forceUpdate(n => n + 1)
  }, [])

  let subagentData: any = null
  if (isAssistant && !isStreaming && message.content) {
    try { subagentData = JSON.parse(message.content) } catch { /* ignore */ }
  }
  if (subagentData?.subagentId) {
    return <SubagentCard stepName={subagentData.task || 'Subagent'} status="running" onOpen={() => { }} />
  }

  // ─── TOOL MESSAGE HANDLING ──────────────────────────────────────────────────
  if (isTool) {
    const parseToolContent = (raw: string): { blocks: Array<{ type: string; text: string }>; isError: boolean } => {
      try {
        const parsed = JSON.parse(raw)
        return {
          blocks: parsed.content ?? [{ type: 'text', text: raw }],
          isError: parsed.is_error ?? false,
        }
      } catch {
        return { blocks: [{ type: 'text', text: raw }], isError: false }
      }
    }

    const { blocks, isError } = parseToolContent(message.content)
    const combinedText = blocks.map(b => b.text).join('\n\n')
    const toolName = (message.metadata as any)?.tool_name as string | undefined

    return (
      <div className="ml-10">
        <ToolResultBubble
          content={combinedText}
          toolName={toolName}
          isError={isError}
        />
      </div>
    )
  }

  // Fallback while highlighter is loading – render plain text without highlighting
  if (!highlighter) {
    return (
      <div className="flex gap-3 max-w-full">
        <div
          className={cn(
            'flex-shrink-0 size-7 rounded-full flex items-center justify-center',
            isUser ? 'bg-primary text-primary-foreground mt-0.5' : 'bg-muted text-foreground mt-1.5'
          )}
          aria-hidden
        >
          {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
        </div>
        <div
          className={cn(
            'flex flex-col min-w-0',
            isUser ? 'items-end' : 'items-start',
            isAssistant ? 'w-full max-w-full' : 'max-w-[78%]'
          )}
        >
          <div className={cn(isUser && 'text-right', 'w-full')}>
            <div
              className={cn(
                'relative px-3.5 py-2.5 rounded-xl text-sm leading-relaxed',
                isUser
                  ? 'bg-primary text-primary-foreground rounded-tr-sm inline-block'
                  : 'bg-muted/50 inline-block'
              )}
            >
              <span className="whitespace-pre-wrap break-words">{message.content}</span>
            </div>
          </div>
        </div>
      </div>
    )
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
          isUser
            ? 'bg-primary text-primary-foreground mt-0.5'
            : isSystem
              ? 'bg-destructive/20 text-destructive mt-0.5'
              : isTool
                ? 'bg-muted text-muted-foreground mt-0.5'
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
      <div
        className={cn(
          'flex flex-col min-w-0',
          isUser ? 'items-end' : 'items-start',
          isAssistant ? 'w-full max-w-full' : 'max-w-[78%]'
        )}
      >
        <div className={cn(isUser && 'text-right', 'w-full')}>
          <div
            ref={contentRef}
            data-message-id={message.id}
            className={cn(
              'relative px-3.5 py-2.5 rounded-xl text-sm leading-relaxed transition-colors duration-300',
              isUser
                ? 'bg-primary text-primary-foreground rounded-tr-sm inline-block'
                : isTool
                  ? 'bg-muted/70 font-mono text-xs w-full rounded-tl-sm inline-block'
                  : showShimmer
                    ? 'bg-transparent inline-block'
                    : isAssistant
                      ? 'bg-transparent w-full inline-block'
                      : 'bg-muted/50 inline-block',
              isQueued && 'border-l-2 border-amber-400 pl-3'
            )}
          >
            {/* Highlight ring */}
            <motion.div
              className={cn(
                'absolute inset-0 ring-2 ring-primary/50 pointer-events-none rounded-inherit',
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
                  onClick={toggleCollapsed}
                  className="p-0.5 hover:bg-muted-foreground/20 rounded transition-colors"
                  aria-label={isCollapsed ? 'Expand message' : 'Collapse message'}
                  whileTap={{ scale: 0.9 }}
                >
                  <motion.div animate={{ rotate: isCollapsed ? 0 : 90 }} transition={{ duration: 0.2 }}>
                    {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </motion.div>
                </motion.button>

                {isAssistant && !isStreaming && !syntheticStreaming && (
                  <AssistantMessageActions
                    message={message}
                    conversationId={activeConversationId}
                    onCopy={copyMessage}
                    onDownload={downloadMessage}
                    onBranch={handleBranch}
                  />
                )}

                {/* Branch parent indicator */}
                {isAssistant && !isStreaming && !syntheticStreaming && isBranchParent && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 ml-1 text-muted-foreground">
                          <GitBranch className="size-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Branch starts here</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}

            <CollapsibleContent ref={collapsibleRef} initialCollapsed={false} messageId={message.id}>
              {isAssistant || syntheticStreaming ? (
                <div
                  ref={proseRef}
                  className="prose prose-sm dark:prose-invert max-w-none break-words prose-p:my-1 prose-headings:my-1 prose-pre:my-0"
                >
                  {showShimmer ? (
                    <div className="flex items-center py-2">
                      <StreamingLoading />
                    </div>
                  ) : (
                    <StreamingContext.Provider value={isStreaming || syntheticStreaming}>
                      <MemoizedMarkdown
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins}
                        components={markdownComponents}
                      >
                        {message.content}
                      </MemoizedMarkdown>
                    </StreamingContext.Provider>
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
            </CollapsibleContent>

            {/* User message actions */}
            {isUser && !isStreaming && !syntheticStreaming && (
              <div className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu modal={false}>
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
                    <DropdownMenuItem
                      onClick={copyMessage}
                      className="cursor-pointer hover:bg-primary/10 hover:text-foreground focus:bg-primary/10 focus:text-foreground"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      <span>Copy</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleBranch}
                      className="cursor-pointer hover:bg-primary/10 hover:text-foreground focus:bg-primary/10 focus:text-foreground"
                    >
                      <GitBranch className="mr-2 h-4 w-4" />
                      <span>Branch from here</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {!isStreaming && !syntheticStreaming && message.content && !collapsedStateRef.current && (
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

        {isUser && onRetry && (
          <div className="text-xs text-muted-foreground mt-1 flex justify-end">
            <button
              type="button"
              onClick={onRetry}
              className="text-xs text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {isAssistant && message.status === 'cancelled' && (
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
            <span className="italic">Cancelled</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-xs text-primary hover:underline"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      <CreateBranchModal
        open={branchModalOpen}
        onClose={() => setBranchModalOpen(false)}
        conversationId={activeConversationId!}
        parentMessageId={message.id}
      />
    </motion.div>
  )
}

export const MessageBubble = memo(
  MessageBubbleInner,
  (prev, next) => {
    if (prev.isStreaming !== next.isStreaming) return false
    if (prev.isHighlighted !== next.isHighlighted) return false
    if (prev.searchQuery !== next.searchQuery) return false
    if (prev.searchCaseSensitive !== next.searchCaseSensitive) return false
    if (prev.searchRegex !== next.searchRegex) return false
    if (prev.message.id !== next.message.id) return false
    if (prev.message.role !== next.message.role) return false
    if (prev.message.metadata !== next.message.metadata) return false
    if (prev.message.context_items !== next.message.context_items) return false
    if (next.isStreaming) return prev.message.content === next.message.content
    return prev.message.content === next.message.content
  }
)
