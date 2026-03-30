// src/components/conversation/message-bubble.tsx
/**
 * MessageBubble — displays a single message using typed node tree (MarkdownView)
 * or plain text fallback for user/system messages.
 */

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
import { toast } from 'sonner'
import { ContextChip } from '@/components/chat/context-chip'
import type { MessageData, NodeDocument, MdNode } from '@/lib/bindings'
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
import { MarkdownView } from '@/components/markdown-view'

interface MessageBubbleProps {
  message: MessageData
  isStreaming?: boolean
  isHighlighted?: boolean
  searchQuery?: string
  searchCaseSensitive?: boolean
  searchRegex?: boolean
  onRetry?: () => void
  isBranchParent?: boolean
  streamingMessage?: NodeDocument | null
}

// ─── Custom loading animation ──────────────────────────────────────────────────
const StreamingLoading = memo(() => (
  <div className="flex items-center gap-1.5 text-muted-foreground">
    <span className="size-1.5 rounded-full bg-current animate-pulse" />
    <span className="size-1.5 rounded-full bg-current animate-pulse [animation-delay:0.2s]" />
    <span className="size-1.5 rounded-full bg-current animate-pulse [animation-delay:0.4s]" />
  </div>
))
StreamingLoading.displayName = 'StreamingLoading'

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

// Helper to convert plain text to a minimal NodeDocument (safe fallback for assistant)
function textToNodeDocument(content: string): NodeDocument {
  // Escape HTML to avoid injection
  const escaped = content.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;'
    if (m === '<') return '&lt;'
    if (m === '>') return '&gt;'
    return m
  })
  const paragraphNode: MdNode = {
    type: 'paragraph',
    id: `fallback-p-${Date.now()}`,
    html: `<p>${escaped}</p>`,
  }
  return {
    stable_nodes: [paragraphNode],
    draft_nodes: [],
    toc_items: [],
    artifact_specs: [],
  }
}

// ─── MessageBubbleInner ────────────────────────────────────────────────────────
function MessageBubbleInner({
  message,
  isStreaming = false,
  isHighlighted = false,
  searchQuery = '',
  searchCaseSensitive = false,
  searchRegex = false,
  onRetry,
  isBranchParent = false,
  streamingMessage,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [branchModalOpen, setBranchModalOpen] = useState(false)
  const proseRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const scrollContainer = useContext(ScrollContainerContext) // FIX: get scroll root

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
        } catch {
          /* node removed */
        }
      })
    }

    if (!searchQuery?.trim() || !message.content) {
      clearMarks()
      return
    }
    clearMarks()
    if (!document.contains(container)) return

    let pattern = searchQuery
    if (!searchRegex) pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
      try {
        textNode.parentNode?.replaceChild(frag, textNode)
      } catch {
        /* ignore */
      }
    }

    return clearMarks
  }, [searchQuery, searchCaseSensitive, searchRegex, message.content, isUser])

  const isQueued = useMemo(() => {
    if (!message.metadata) return false
    try {
      const meta = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata
      return meta.from_queue === true
    } catch {
      return false
    }
  }, [message.metadata])

  const contextItems = message.context_items || []
  const shouldHighlight = searchQuery && message.content

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
    forceUpdate((n) => n + 1)
  }, [])

  let subagentData: any = null
  if (isAssistant && !isStreaming && message.content) {
    try {
      subagentData = JSON.parse(message.content)
    } catch {
      /* ignore */
    }
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
    const combinedText = blocks.map((b) => b.text).join('\n\n')
    const toolName = (message.metadata as any)?.tool_name as string | undefined

    return (
      <div className="ml-10">
        <ToolResultBubble content={combinedText} toolName={toolName} isError={isError} />
      </div>
    )
  }

  // ─── ASSISTANT MESSAGES (vertical layout: avatar+header on same row, content below) ───
  if (isAssistant || syntheticStreaming) {
    const nodeDocument = (message as any).node_document as NodeDocument | null | undefined
    const documentToRender = (nodeDocument != null ? nodeDocument : null)
      ?? streamingMessage
      ?? (message.content ? textToNodeDocument(message.content) : null)

    const showShimmer = (isAssistant || syntheticStreaming) && isStreaming && !documentToRender

    const contentElement = showShimmer ? (
      <StreamingLoading />
    ) : documentToRender ? (
      <MarkdownView
        document={documentToRender}
        messageId={message.id}
        className="prose prose-sm dark:prose-invert max-w-none break-words"
        conversationId={activeConversationId}
        isStreaming={isStreaming || syntheticStreaming}
        scrollContainerRef={scrollContainer} // FIX: pass scroll container
      />
    ) : null

    if (!contentElement && !showShimmer && !documentToRender) return null

    return (
      <motion.div
        id={`msg-${message.id}`}
        className="flex flex-col max-w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {/* Row 1: Avatar + header (Assistant label, buttons) */}
        <div className="flex items-start gap-2">
          <div
            className={cn(
              'flex-shrink-0 size-7 rounded-full flex items-center justify-center',
              'bg-muted text-foreground'
            )}
            aria-hidden
          >
            <Bot className="size-3.5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="text-xs font-medium">Assistant</span>
              {canCollapse && (
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
              )}
              {isAssistant && !isStreaming && !syntheticStreaming && (
                <AssistantMessageActions
                  message={message}
                  conversationId={activeConversationId}
                  onCopy={copyMessage}
                  onDownload={downloadMessage}
                  onBranch={handleBranch}
                />
              )}
              {isAssistant && !isStreaming && !syntheticStreaming && isBranchParent && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
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
          </div>
        </div>

        {/* Row 2: Message content – aligned with avatar's left edge */}
        <div className="mt-1">
          <div
            ref={contentRef}
            data-message-id={message.id}
            className={cn(
              'relative py-2.5 pr-3.5 text-sm leading-relaxed transition-colors duration-300',
              'bg-transparent w-full inline-block',
              isQueued && 'border-l-2 border-amber-400 pl-3'
            )}
          >
            {/* Highlight ring */}
            <motion.div
              className="absolute inset-0 ring-2 ring-primary/50 pointer-events-none rounded-xl"
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

            <CollapsibleContent ref={collapsibleRef} initialCollapsed={false} messageId={message.id}>
              {contentElement}
            </CollapsibleContent>
          </div>
        </div>

        {/* Copy button – aligned with content */}
        <AnimatePresence>
          {!isStreaming && !syntheticStreaming && message.content && !collapsedStateRef.current && (
            <motion.button
              key="copy-button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={copyMessage}
              className="mt-1 p-1 text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 shadow-none self-start"
              aria-label="Copy message"
            >
              {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
            </motion.button>
          )}
        </AnimatePresence>

        {isAssistant && message.status === 'cancelled' && (
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
            <span className="italic">Cancelled</span>
            {onRetry && (
              <button type="button" onClick={onRetry} className="text-xs text-primary hover:underline">
                Retry
              </button>
            )}
          </div>
        )}

        <CreateBranchModal
          open={branchModalOpen}
          onClose={() => setBranchModalOpen(false)}
          conversationId={activeConversationId!}
          parentMessageId={message.id}
        />
      </motion.div>
    )
  }

  // ─── USER / SYSTEM MESSAGES (plain text fallback) ──────────────────────────
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
              : 'bg-muted text-foreground mt-1.5'
        )}
        aria-hidden
      >
        {isUser ? (
          <User className="size-3.5" />
        ) : isSystem ? (
          <AlertCircle className="size-3.5" />
        ) : (
          <Bot className="size-3.5" />
        )}
      </div>

      {/* Message container */}
      <div
        className={cn(
          'flex flex-col min-w-0',
          isUser ? 'items-end' : 'items-start',
          'max-w-[78%]'
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
                : 'bg-muted/50 inline-block',
              isQueued && 'border-l-2 border-amber-400 pl-3'
            )}
          >
            {/* Highlight ring */}
            <motion.div
              className={cn(
                'absolute inset-0 ring-2 ring-primary/50 pointer-events-none rounded-inherit',
                isUser ? 'rounded-xl rounded-tr-sm' : 'rounded-xl'
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
                  {isUser ? 'User' : 'System'}
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
              </div>
            )}

            <CollapsibleContent ref={collapsibleRef} initialCollapsed={false} messageId={message.id}>
              {shouldHighlight ? (
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
            <button type="button" onClick={onRetry} className="text-xs text-primary hover:underline">
              Retry
            </button>
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
    // Re-render only when necessary
    if (prev.isStreaming !== next.isStreaming) return false
    if (prev.isHighlighted !== next.isHighlighted) return false
    if (prev.searchQuery !== next.searchQuery) return false
    if (prev.searchCaseSensitive !== next.searchCaseSensitive) return false
    if (prev.searchRegex !== next.searchRegex) return false
    if (prev.message.id !== next.message.id) return false
    if (prev.message.role !== next.message.role) return false
    if (prev.message.metadata !== next.message.metadata) return false
    if (prev.message.context_items !== next.message.context_items) return false
    if (prev.isBranchParent !== next.isBranchParent) return false

    // Synthetic streaming bubble must re-render when document changes
    const syntheticStreaming = next.message.id === '__streaming__'
    if (syntheticStreaming) {
      return prev.streamingMessage === next.streamingMessage
    }

    // Settled messages: skip re-render during active streaming (they don't change)
    if (next.isStreaming || prev.isStreaming) return true

    // Otherwise, re-render only if content changed
    return prev.message.content === next.message.content
      && prev.streamingMessage === next.streamingMessage
  }
)
