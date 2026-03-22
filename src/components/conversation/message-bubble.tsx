// src/components/conversation/message-bubble.tsx
// ─── DEBUG INSTRUMENTATION ────────────────────────────────────────────────────
const DEBUG = true

// ── Render counters ───────────────────────────────────────────────────────────
const renderCounts = new Map<string, number>()
function getRenderCount(key: string) {
  const n = (renderCounts.get(key) ?? 0) + 1
  renderCounts.set(key, n)
  return n
}

// ── Why-render tracker ────────────────────────────────────────────────────────
function dbgWhyRender(
  component: string,
  instanceId: string,
  current: Record<string, unknown>,
  prevRef: React.MutableRefObject<Record<string, unknown> | null>
) {
  if (!DEBUG) return
  const id8 = instanceId.slice(0, 8)
  const n = getRenderCount(`${component}::${instanceId}`)
  const prev = prevRef.current
  if (!prev) {
    console.log(`[MB:${component}] [${id8}] #${n} MOUNT`)
    prevRef.current = current
    return
  }
  const changed: Record<string, { from: unknown; to: unknown }> = {}
  for (const k of Object.keys(current)) {
    if (prev[k] !== current[k]) changed[k] = { from: prev[k], to: current[k] }
  }
  if (Object.keys(changed).length === 0) {
    console.warn(`[MB:${component}] [${id8}] #${n} RE-RENDER — NO prop changes (context/state)`)
  } else {
    console.log(`[MB:${component}] [${id8}] #${n} RE-RENDER`, changed)
  }
  prevRef.current = current
}

// ── performance.mark helpers ──────────────────────────────────────────────────
function mark(name: string) { if (DEBUG) performance.mark(name) }
function measure(name: string, start: string, end: string) {
  if (!DEBUG) return
  try {
    const m = performance.measure(name, start, end)
    const flag = m.duration > 16 ? '🔴' : m.duration > 4 ? '🟡' : '🟢'
    console.log(`[MB:PERF] ${flag} ${name}: ${m.duration.toFixed(2)}ms`)
  } catch { /* marks missing */ }
}

// ── Frame-time probe ──────────────────────────────────────────────────────────
function dbgMeasureToFrame(label: string) {
  if (!DEBUG) return
  const t0 = performance.now()
  requestAnimationFrame(() => {
    const delta = performance.now() - t0
    const flag = delta > 16 ? '🔴 JANK' : delta > 8 ? '🟡 SLOW' : '🟢 OK'
    console.log(`[MB:PERF] ${flag} "${label}" → next frame in ${delta.toFixed(1)}ms`)
  })
}

// ── Zustand selector call counter ─────────────────────────────────────────────
let _selectorCallsThisTick = 0
let _selectorTickScheduled = false
function trackSelectorCall(label: string) {
  if (!DEBUG) return
  _selectorCallsThisTick++
  if (!_selectorTickScheduled) {
    _selectorTickScheduled = true
    queueMicrotask(() => {
      console.log(`[MB:PERF] Zustand selectors this tick: ${_selectorCallsThisTick} (last: "${label}")`)
      _selectorCallsThisTick = 0
      _selectorTickScheduled = false
    })
  }
}

// ── React render batch counter ────────────────────────────────────────────────
let _renderCallsThisBatch = 0
let _renderBatchScheduled = false
function trackRender(_component: string, _id: string) {
  if (!DEBUG) return
  _renderCallsThisBatch++
  if (!_renderBatchScheduled) {
    _renderBatchScheduled = true
    requestAnimationFrame(() => {
      console.log(`[MB:PERF] React rendered ${_renderCallsThisBatch} components in last batch`)
      _renderCallsThisBatch = 0
      _renderBatchScheduled = false
    })
  }
}

// ── Long-task observer ────────────────────────────────────────────────────────
// Every task >50ms gets logged with its start time. Cross-reference the
// startTime against when onOpenChange fires to isolate which long task
// is responsible for the 1778ms block.
if (DEBUG && typeof PerformanceObserver !== 'undefined') {
  try {
    const _ltObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const attr = (entry as any).attribution
        const attrStr = attr
          ? attr.map((a: any) =>
            [a.containerType, a.containerName, a.name].filter(Boolean).join('/')
          ).join(', ')
          : 'n/a'
        console.warn(
          `[MB:LONGTASK] 🔴 ${entry.duration.toFixed(0)}ms @ t+${entry.startTime.toFixed(0)}ms | ${attrStr}`
        )
      }
    })
    _ltObs.observe({ type: 'longtask', buffered: true })
    console.log('[MB:PERF] LongTask observer active (reports tasks >50ms)')
  } catch { /* longtask not supported in this environment */ }
}

// ── onOpenChange timestamp anchor ─────────────────────────────────────────────
// We can't mark the click reliably (Radix swallows it), so instead we mark
// onOpenChange and use the LongTask startTimes to see what ran before/after.
let _openChangeTime = 0

import rehypeShiki from '@shikijs/rehype'
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
} from 'lucide-react'
import React, { memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MarkdownHooks } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import type { Highlighter } from 'shiki'
import { createHighlighter } from 'shiki'
import { toast } from 'sonner'
import { ContextChip } from '@/components/chat/context-chip'
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
import { ScrollContainerContext, AutoScrollContext } from './message-thread'
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

// ─── Stable plugin arrays (module-level, never recreated) ─────────────────────
const remarkPlugins = [remarkGfm]
const rehypePluginsBase = [rehypeLinkifyCodeUrls, rehypeSlug]

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
function CodePre({ children, ...props }: any) {
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
      // Code block must actually overflow its internal scroll container
      // for the sticky header to make any sense at all.
      const codeOverflows = scrollable.scrollHeight > scrollable.clientHeight
      if (collapsed || !codeOverflows) {
        hide()
        return
      }

      const rootRect = root.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // Guard: skip if the scroll container itself has no layout yet
      // (happens during initial mount, streaming, or while the parent
      // message bubble is being measured by the virtualizer).
      if (rootRect.width === 0 || rootRect.height === 0) {
        hide()
        return
      }

      // The code block header has scrolled off the top of the thread viewport
      const topGone = containerRect.top < rootRect.top
      // At least 32px of the code block's body is still visible (not just clipped)
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

    // Debounce ResizeObserver through rAF so we never read getBoundingClientRect
    // mid-layout (e.g. during streaming when new lines are being added).
    // This eliminates the flicker caused by stale layout values.
    let rafId = 0
    const syncRaf = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(sync)
    }

    root.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(syncRaf)
    ro.observe(container)
    ro.observe(scrollable)
    // Run once after mount — use rAF so layout is stable
    rafId = requestAnimationFrame(sync)

    return () => {
      root.removeEventListener('scroll', sync)
      ro.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [scrollContainer, collapsed])

  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), [])

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
            // No opacity transition — spurious sync() calls during streaming/layout
            // would cause visible flicker. opacity is set instantly.
            // border-radius and shadow still animate for the sticky→normal transition.
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

// ─── Assistant message actions ─────────────────────────────────────────────────
const AssistantMessageActions = memo(function AssistantMessageActions({
  message,
  conversationId,
  onCopy,
  onDownload,
}: {
  message: MessageData
  conversationId: string | null
  onCopy: () => void
  onDownload: () => void
}) {
  // Track every render of this component
  trackRender('Actions', message.id)
  const prevValuesRef = useRef<Record<string, unknown> | null>(null)
  dbgWhyRender('Actions', message.id, {
    messageId: message.id,
    conversationId,
    onCopyRef: onCopy,
    onDownloadRef: onDownload,
  }, prevValuesRef)

  const selectorFn = useCallback(
    (s: any) => {
      if (!conversationId) return false
      const convBookmarks = s.bookmarks[conversationId]
      if (!convBookmarks || !Array.isArray(convBookmarks)) return false
      return convBookmarks.some((b: any) => b.message_id === message.id && !b.heading_anchor)
    },
    [conversationId, message.id]
  )

  const isBookmarked = useBookmarksStore((s) => {
    const result = selectorFn(s)
    trackSelectorCall(`Actions[${message.id.slice(0, 8)}] isBookmarked`)
    return result
  })

  const onBookmark = useCallback(() => {
    if (!conversationId) return
    useBookmarksStore.getState().toggleBookmark(conversationId, message.id, undefined, 'Message')
  }, [conversationId, message.id])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!DEBUG) return
    if (open) {
      _openChangeTime = performance.now()
      mark('dropdown:onOpenChange:open')
      // Log the timestamp so we can correlate with LongTask startTimes in the console.
      // LongTask entries report startTime relative to navigationStart — if a longtask
      // startTime is >= _openChangeTime, it happened AFTER onOpenChange, meaning
      // Radix's own portal/focus code is the culprit, not React rendering.
      console.log(
        `[MB:Actions] [${message.id.slice(0, 8)}] onOpenChange → true`,
        `| t=${_openChangeTime.toFixed(0)}ms`,
        `| any LONGTASK with startTime ≥ this = Radix cost`
      )
      dbgMeasureToFrame('onOpenChange(true) → paint')
    } else {
      mark('dropdown:onOpenChange:close')
      dbgMeasureToFrame('onOpenChange(false) → paint')
      console.log(`[MB:Actions] [${message.id.slice(0, 8)}] onOpenChange → false`)
    }
  }, [message.id])

  return (
    <DropdownMenu onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-0.5 hover:bg-muted-foreground/20 rounded transition-colors"
          aria-label="Message options"
          onClick={() => {
            if (!DEBUG) return
            // This fires at the very start of the click, before React does anything.
            mark('dropdown:click')
            dbgMeasureToFrame('click → paint (total blocked time)')
            console.log(`[MB:Actions] [${message.id.slice(0, 8)}] trigger clicked`)
          }}
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
  trackRender('HeadingBtn', `${messageId}::${headingAnchor}`)
  const prevValuesRef = useRef<Record<string, unknown> | null>(null)
  dbgWhyRender('HeadingBtn', `${messageId}::${headingAnchor}`, {
    messageId, headingAnchor, headingLabel, conversationId,
  }, prevValuesRef)

  const isBookmarked = useBookmarksStore(
    useCallback(
      (s) => {
        if (!conversationId) return false
        const convBookmarks = s.bookmarks[conversationId]
        if (!convBookmarks || !Array.isArray(convBookmarks)) return false
        const result = convBookmarks.some(
          (b) => b.message_id === messageId && b.heading_anchor === headingAnchor
        )
        trackSelectorCall(`HeadingBtn[${headingAnchor}]`)
        return result
      },
      [conversationId, messageId, headingAnchor]
    )
  )

  const toggle = useCallback(() => {
    if (!conversationId) return
    useBookmarksStore.getState().toggleBookmark(conversationId, messageId, headingAnchor, headingLabel)
  }, [conversationId, messageId, headingAnchor, headingLabel])

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle() }}
      className={cn(
        'ml-1.5 p-0.5 rounded hover:bg-muted-foreground/10 align-middle inline-flex items-center transition-opacity',
        isBookmarked ? 'opacity-100' : 'opacity-0 group-hover/heading:opacity-100'
      )}
      aria-label={isBookmarked ? 'Remove heading bookmark' : 'Bookmark this heading'}
    >
      <Bookmark
        className={cn(
          'size-3 transition-colors',
          isBookmarked ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'
        )}
      />
    </button>
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
    <table className="border-collapse border border-border text-xs">{children}</table>
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
  <td className="border border-border px-2 py-1" {...props}>{children}</td>
))
Td.displayName = 'Td'

// ─── Shared rehype plugins cache keyed by highlighter instance ───────────────
const rehypePluginsCache = new WeakMap<Highlighter, any[]>()
function getRehypePlugins(highlighter: Highlighter | null) {
  if (!highlighter) return rehypePluginsBase
  let cached = rehypePluginsCache.get(highlighter)
  if (!cached) {
    cached = [
      [rehypeShiki, { highlighter, themes: { light: 'vitesse-light', dark: 'vitesse-dark' }, useBackground: false }],
      ...rehypePluginsBase,
    ]
    rehypePluginsCache.set(highlighter, cached)
  }
  return cached
}

// ─── Hook: build markdown components, stable across streaming ─────────────────
// Components only change when messageId, activeConversationId, or scrollContainer changes.
// Critically: NOT on message.content — we use a ref for the heading counter instead.
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
    if (DEBUG) console.log(`[MB:useMarkdownComponents] [${messageId.slice(0, 8)}] recomputing — deps changed`, {
      messageId, activeConversationId,
      scrollContainerRef: scrollContainer,
      headingIndexRef,
    })
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
// The single biggest cost: MarkdownHooks re-runs the full remark/rehype
// pipeline on every render even when content hasn't changed. This wrapper
// memoizes on (children, rehypePlugins, components) so re-renders caused by
// Radix flushSync or context changes don't re-parse markdown.
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
// Replaces maxHeight:99999 transition with a measured height animation.
// maxHeight:99999 forces the browser to animate across ~99000px of layout space
// even for small content — measuring the real scrollHeight first means the
// animation only covers the actual content height (e.g. 400px not 99999px).
// Uses imperative DOM refs so the animation doesn't trigger React re-renders.
function CollapsibleContent({
  isCollapsed,
  messageId,
  children,
}: {
  isCollapsed: boolean
  messageId: string
  children: React.ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return

    // Skip the first render — inline styles in the JSX already set the correct
    // initial values. Only animate on subsequent isCollapsed changes.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (isCollapsed) {
      // Collapse: measure current height → animate to 0
      const t0 = performance.now()
      const currentHeight = el.scrollHeight
      el.style.maxHeight = `${currentHeight}px`
      el.style.overflow = 'hidden'
      // Force reflow so the browser registers the start value
      el.getBoundingClientRect()
      el.style.transition = 'max-height 0.18s ease, opacity 0.18s ease'
      el.style.maxHeight = '0px'
      el.style.opacity = '0'
      if (DEBUG) {
        mark('collapse:animate:start')
        console.log(`[MB:Collapse] [${messageId.slice(0, 8)}] collapsing from ${currentHeight}px`)
        dbgMeasureToFrame('collapse animate → paint')
      }
    } else {
      // Expand: animate from 0 → measured scrollHeight, then remove maxHeight
      const targetHeight = el.scrollHeight
      el.style.transition = 'max-height 0.18s ease, opacity 0.18s ease'
      el.style.maxHeight = `${targetHeight}px`
      el.style.opacity = '1'
      if (DEBUG) {
        mark('collapse:animate:start')
        console.log(`[MB:Collapse] [${messageId.slice(0, 8)}] expanding to ${targetHeight}px`)
        dbgMeasureToFrame('expand animate → paint')
      }
      // After animation, remove maxHeight so content can grow freely (e.g. images loading)
      const onEnd = () => {
        if (outerRef.current && !isCollapsed) {
          outerRef.current.style.maxHeight = 'none'
          outerRef.current.style.overflow = 'visible'
          outerRef.current.style.transition = ''
        }
        el.removeEventListener('transitionend', onEnd)
      }
      el.addEventListener('transitionend', onEnd)
    }
  }, [isCollapsed, messageId])

  return (
    <div
      ref={outerRef}
      style={{
        // Set correct initial values inline so content is never clipped on first paint.
        // useLayoutEffect will take over for subsequent isCollapsed changes.
        overflow: isCollapsed ? 'hidden' : 'visible',
        maxHeight: isCollapsed ? '0px' : 'none',
        opacity: isCollapsed ? 0 : 1,
      }}
    >
      {children}
    </div>
  )
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubbleInner({
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

  // Mark the start of this bubble's render for perf timeline
  const renderMarkStart = `bubble-render:${message.id}:start`
  mark(renderMarkStart)
  trackRender('Bubble', message.id)

  const activeConversationId = useUIStore((s) => {
    trackSelectorCall(`Bubble[${message.id.slice(0, 8)}] UIStore`)
    return s.activeConversationId
  })
  const scrollContainer = useContext(ScrollContainerContext)

  const isBookmarked = useBookmarksStore(
    useCallback(
      (s) => {
        if (!activeConversationId) return false
        const convBookmarks = s.bookmarks[activeConversationId]
        if (!convBookmarks || !Array.isArray(convBookmarks)) return false
        const result = convBookmarks.some((b) => b.message_id === message.id)
        trackSelectorCall(`Bubble[${message.id.slice(0, 8)}] isBookmarked`)
        return result
      },
      [activeConversationId, message.id]
    )
  )

  // ─── Why-render tracking ──────────────────────────────────────────────────
  const prevBubbleValuesRef = useRef<Record<string, unknown> | null>(null)
  dbgWhyRender('Bubble', message.id, {
    messageId: message.id,
    role: message.role,
    contentLength: message.content?.length ?? 0,
    metadata: message.metadata,
    isStreaming,
    isHighlighted,
    searchQuery,
    searchCaseSensitive,
    searchRegex,
    activeConversationId,
    isBookmarked,
    scrollContainerRef: scrollContainer,
  }, prevBubbleValuesRef)

  // Load Shiki asynchronously
  useEffect(() => {
    getHighlighter().then(setHighlighter)
  }, [])

  // ─── Heading counter via ref — reset when messageId changes, NOT on content ──
  const headingIndexRef = useRef(0)
  const lastMessageIdRef = useRef('')
  if (lastMessageIdRef.current !== message.id) {
    lastMessageIdRef.current = message.id
    headingIndexRef.current = 0
  }
  // Also reset on content during streaming (new content may reorder headings)
  const lastContentLenRef = useRef(0)
  if (isStreaming) {
    // Only reset if content shrank (rare edge case, e.g. edit) or is a fresh stream
    if (message.content.length < lastContentLenRef.current) {
      headingIndexRef.current = 0
    }
    lastContentLenRef.current = message.content.length
  }

  const rehypePlugins = getRehypePlugins(highlighter)
  const markdownComponents = useMarkdownComponents(
    message.id,
    activeConversationId,
    scrollContainer,
    headingIndexRef
  )

  // ─── Search highlighting effect ──────────────────────────────────────────
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

  // Track whether callbacks are stable — new identity = AssistantMessageActions will re-render
  const prevCopyRef = useRef<Function | null>(null)
  const prevDownloadRef = useRef<Function | null>(null)
  if (DEBUG) {
    if (prevCopyRef.current && prevCopyRef.current !== copyMessage) {
      console.warn(`[MB:Bubble] [${message.id.slice(0, 8)}] copyMessage identity changed — AssistantMessageActions will re-render. Dep: message.content length=${message.content.length}`)
    }
    if (prevDownloadRef.current && prevDownloadRef.current !== downloadMessage) {
      console.warn(`[MB:Bubble] [${message.id.slice(0, 8)}] downloadMessage identity changed — AssistantMessageActions will re-render. Deps: id=${message.id} contentLen=${message.content.length}`)
    }
    prevCopyRef.current = copyMessage
    prevDownloadRef.current = downloadMessage
  }

  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), [])

  let subagentData: any = null
  if (isAssistant && !isStreaming && message.content) {
    try { subagentData = JSON.parse(message.content) } catch { /* ignore */ }
  }
  if (subagentData?.subagentId) {
    return <SubagentCard stepName={subagentData.task || 'Subagent'} status="running" onOpen={() => { }} />
  }

  if (DEBUG) {
    // Close the render mark — everything between renderMarkStart and here is
    // synchronous React work for this one bubble (hooks, useMemo, etc.)
    const renderMarkEnd = `bubble-render:${message.id}:end`
    mark(renderMarkEnd)
    measure(
      `⚛️ Bubble[${message.id.slice(0, 8)}] render (sync JS)`,
      `bubble-render:${message.id}:start`,
      renderMarkEnd
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
                  onClick={() => {
                    if (DEBUG) {
                      mark('collapse:click')
                      dbgMeasureToFrame('collapse toggle → paint')
                      console.log(`[MB:Collapse] [${message.id.slice(0, 8)}] toggle clicked, currently collapsed=${isCollapsed}`)
                    }
                    toggleCollapsed()
                  }}
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
                  />
                )}
              </div>
            )}

            {/* NOTE: maxHeight:99999 causes CSS to animate the full 0→99999px range
                  even for small content, forcing the browser to compute layout across
                  ~99000px of virtual space on every animation frame = jank.
                  Replaced with a measured approach: on expand we read the real
                  scrollHeight and animate to that. On collapse we animate to 0. */}
            <CollapsibleContent isCollapsed={isCollapsed} messageId={message.id}>
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
                      {/* MemoizedMarkdown skips re-parsing when content/plugins unchanged.
                            This is the critical guard against Radix flushSync causing
                            remark/rehype to re-run for every visible assistant message. */}
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
