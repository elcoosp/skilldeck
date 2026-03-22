/**
 * Center panel — virtualized message thread and input bar.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { ArrowDown, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { BranchNav } from '@/components/conversation/branch-nav'
import { MessageInput } from '@/components/conversation/message-input'
import {
  MessageThread,
  type MessageThreadHandle,
  type ScrollToken,
} from '@/components/conversation/message-thread'
import ThreadNavigator from '@/components/conversation/thread-navigator'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { useActiveConversationWorkspaceId } from '@/hooks/use-conversations'
import { useMessagesWithStream } from '@/hooks/use-messages'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'
import { extractHeadings } from '@/lib/markdown-toc'
import { useAssistantMessageStore } from '@/store/assistant-messages'

// ─── Scroll token cache ───────────────────────────────────────────────────────
// Persists scroll positions across conversation switches within the session.
const scrollTokenCache = new Map<string, ScrollToken>()

export function CenterPanel() {
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const activeBranchId = useUIStore((s) => s.activeBranchId)

  const scrollToMessageId = useUIStore((s) => s.scrollToMessageId)
  const setScrollToMessageId = useUIStore((s) => s.setScrollToMessageId)

  const workspaceId = useActiveConversationWorkspaceId()
  const { data: workspaces = [] } = useWorkspaces()
  const activeWorkspace = workspaces.find((w) => w.id === workspaceId)
  const workspaceRoot = activeWorkspace?.path

  const searchQuery = useUIStore((s) => s.conversationSearchQuery)
  const setSearchQuery = useUIStore((s) => s.setConversationSearchQuery)
  const [debouncedSearch] = useDebounce(searchQuery, 300)
  const [autoScroll, setAutoScroll] = useState(true)

  const threadRef = useRef<MessageThreadHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activeUserMessageIndex, setActiveUserMessageIndex] = useState<number | undefined>(undefined)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Streaming state ──────────────────────────────────────────────────────
  const { isRunning } = useAgentStream(activeConversationId)
  const messages = useMessagesWithStream(activeConversationId, activeBranchId)

  const streamingMessageId = (() => {
    if (!isRunning) return undefined
    const last = messages[messages.length - 1]
    return last?.role === 'assistant' ? last.id : undefined
  })()

  // ─── Headings extraction for assistant messages ───────────────────────────
  const setHeadings = useAssistantMessageStore((s) => s.setHeadings)
  const clearHeadings = useAssistantMessageStore((s) => s.clearHeadings)

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.content && msg.id !== '__streaming__') {
        const headings = extractHeadings(msg.content)
        if (headings.length > 0) setHeadings(msg.id, headings)
        else clearHeadings(msg.id)
      }
    }
  }, [messages, setHeadings, clearHeadings])

  // ─── Conversation key ─────────────────────────────────────────────────────
  const activeKey = activeConversationId
    ? `${activeConversationId}_${activeBranchId ?? 'main'}`
    : undefined

  // ─── Save scroll token on conversation switch (synchronous during render) ─
  // Skips saving if a programmatic scroll is mid-flight — the scrollTop is
  // unreliable during the convergence loop and would restore to the wrong place.
  const activeKeyRef = useRef<string | undefined>(undefined)
  if (activeKeyRef.current !== activeKey) {
    if (activeKeyRef.current && threadRef.current) {
      if (!threadRef.current.isScrollingToMessage?.()) {
        const token = threadRef.current.getScrollToken()
        if (token) scrollTokenCache.set(activeKeyRef.current, token)
      }
    }
    activeKeyRef.current = activeKey
  }

  const initialScrollToken = (() => {
    if (!activeKey) return undefined
    const cached = scrollTokenCache.get(activeKey)
    if (!cached || typeof cached.messageId !== 'string') return undefined
    return cached
  })()

  // ─── Jump-to-latest + unseen badge ───────────────────────────────────────
  const realMessageCount = messages.filter(m => m.id !== '__streaming__').length
  const messagesLengthRef = useRef(realMessageCount)
  messagesLengthRef.current = realMessageCount

  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [unseenCount, setUnseenCount] = useState(0)
  const lastSeenCountRef = useRef(realMessageCount)

  useEffect(() => {
    lastSeenCountRef.current = messagesLengthRef.current
    setUnseenCount(0)
    setShowJumpToLatest(false)
  }, [activeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isRunning) {
      lastSeenCountRef.current = messagesLengthRef.current
      setUnseenCount(0)
    }
  }, [isRunning]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!scrollToMessageId || !messages.length) return
    const targetMessage = messages.find(m => m.id === scrollToMessageId)
    if (targetMessage) {
      const fullIndex = messages.findIndex(m => m.id === scrollToMessageId)
      threadRef.current?.scrollToMessage(fullIndex)
      setHighlightedMessageId(scrollToMessageId)
      setTimeout(() => setHighlightedMessageId(null), 800)
      setScrollToMessageId(null)
    }
  }, [scrollToMessageId, messages, setScrollToMessageId])
  const computeShowJump = useCallback(() => {
    const el = threadRef.current?.getScrollElement()
    if (!el) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100
    setShowJumpToLatest(!nearBottom && messagesLengthRef.current > 0)
    if (nearBottom) {
      lastSeenCountRef.current = messagesLengthRef.current
      setUnseenCount(0)
    } else {
      setUnseenCount(Math.max(0, messagesLengthRef.current - lastSeenCountRef.current))
    }
  }, [])

  useEffect(() => {
    let unsub = () => { }
    const t = setTimeout(() => {
      const thread = threadRef.current
      if (!thread) return
      unsub = thread.onScroll(computeShowJump)
      computeShowJump()
    }, 50)
    return () => { clearTimeout(t); unsub() }
  }, [activeKey, computeShowJump])

  useEffect(() => { computeShowJump() }, [realMessageCount, computeShowJump])

  // ─── Jump to latest ───────────────────────────────────────────────────────
  const jumpToLatest = useCallback(() => {
    if (messages.length === 0) return
    threadRef.current?.scrollToBottom()
    lastSeenCountRef.current = messagesLengthRef.current
    setUnseenCount(0)
    const lastMsg = messages[messages.length - 1]
    if (lastMsg) {
      setHighlightedMessageId(lastMsg.id)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
    }
  }, [messages])

  // ─── Scroll settled — save token after programmatic navigation ────────────
  const handleScrollSettled = useCallback((token: ScrollToken) => {
    if (activeKeyRef.current) {
      scrollTokenCache.set(activeKeyRef.current, token)
      console.log(`[CenterPanel] token saved after convergence scrollTop=${token.scrollTop}`)
    }
  }, [])

  // ─── Thread navigator ─────────────────────────────────────────────────────
  const handleVisibleUserIndexChange = useCallback((index: number) => {
    setActiveUserMessageIndex(index)
  }, [])

  const handleNavigatorScrollTo = useCallback((index: number) => {
    const targetMessage = messages[index]
    if (!targetMessage) return
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    setHighlightedMessageId(targetMessage.id)
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
    threadRef.current?.scrollToMessage(index)
  }, [messages])

  // ─── Heading click handler (two‑phase scroll) ────────────────────────────
  const handleHeadingClick = useCallback((messageIndex: number, headingId: string) => {
    // First, scroll to the assistant message containing the heading
    threadRef.current?.scrollToMessage(messageIndex)
    // After the virtualizer settles (roughly 300ms), scroll the heading into view
    setTimeout(() => {
      const headingElement = document.getElementById(headingId)
      const scrollContainer = threadRef.current?.getScrollElement()
      if (headingElement && scrollContainer) {
        const elTop = headingElement.getBoundingClientRect().top
        const containerTop = scrollContainer.getBoundingClientRect().top
        scrollContainer.scrollTop += elTop - containerTop - 16 // 16px padding
      }
    }, 300)
  }, [])

  // ─── Keyboard shortcut ⌘F / Ctrl+F ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ─── Clear search on conversation switch ─────────────────────────────────
  useEffect(() => {
    setSearchQuery('')
  }, [activeConversationId, setSearchQuery])

  const modifierKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'

  if (!activeConversationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
          <span className="text-2xl">✦</span>
        </div>
        <h2 className="text-lg font-medium">Welcome to SkillDeck</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Pick a thread or create a new one to get chatting.
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full">
      {activeConversationId && <BranchNav conversationId={activeConversationId} />}

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            placeholder="Search in this conversation…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-16 h-8 text-sm"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            <KbdGroup><Kbd>{modifierKey}</Kbd><Kbd>F</Kbd></KbdGroup>
          </div>
        </div>
        {searchQuery && (
          <Button variant="ghost" size="icon-sm" onClick={() => setSearchQuery('')} aria-label="Clear search">
            <X className="size-3.5" />
          </Button>
        )}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="size-3 accent-primary cursor-pointer"
          />
          Auto-scroll
        </label>
      </div>

      {/* Message thread — no key= prop, conversationKey drives internal reset */}
      <div className="relative flex-1 min-h-0">
        <MessageThread
          ref={threadRef}
          conversationKey={activeKey ?? ''}
          messages={messages}
          streamingMessageId={streamingMessageId}
          searchQuery={debouncedSearch}
          highlightedMessageId={highlightedMessageId}
          initialScrollToken={initialScrollToken}
          autoScroll={autoScroll}
          onVisibleUserIndexChange={handleVisibleUserIndexChange}
          onScrollSettled={handleScrollSettled}
        />

        {messages.length > 2 && (
          <ThreadNavigator
            messages={messages}
            activeIndex={activeUserMessageIndex}
            onScrollTo={handleNavigatorScrollTo}
            onHeadingClick={handleHeadingClick}
          />
        )}

        {/* Jump to latest button */}
        <button
          type="button"
          onClick={jumpToLatest}
          className={cn(
            'absolute bottom-4 right-4 z-30 flex items-center justify-center w-8 h-8 rounded-full bg-card border border-border shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            showJumpToLatest
              ? 'opacity-100 visible pointer-events-auto'
              : 'opacity-0 invisible pointer-events-none'
          )}
          aria-label="Jump to latest message"
          title="Jump to latest"
        >
          <ArrowDown className="size-4" />
          {unseenCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center px-1 leading-none">
              {unseenCount > 99 ? '99+' : unseenCount}
            </span>
          )}
        </button>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border">
        <MessageInput conversationId={activeConversationId} workspaceRoot={workspaceRoot} />
      </div>
    </div>
  )
}
