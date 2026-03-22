/**
 * Center panel — virtualized message thread and input bar.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
const scrollTokenCache = new Map<string, ScrollToken>()

// ─── Heading extraction: runs outside React, result is cached by message id ──
// We track which (id, content-length) pairs we've already processed so we
// never call extractHeadings twice for the same content, and never touch the
// store for messages that haven't changed.
const headingCache = new Map<string, { contentLen: number; hasHeadings: boolean }>()

export function CenterPanel() {
  // ─── Granular UIStore selectors (primitives only — no object selectors) ───
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const activeBranchId = useUIStore((s) => s.activeBranchId)
  const scrollToMessageId = useUIStore((s) => s.scrollToMessageId)
  const setScrollToMessageId = useUIStore((s) => s.setScrollToMessageId)
  const searchQuery = useUIStore((s) => s.conversationSearchQuery)
  const setSearchQuery = useUIStore((s) => s.setConversationSearchQuery)

  const [debouncedSearch] = useDebounce(searchQuery, 300)
  const [autoScroll, setAutoScroll] = useState(true)
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false)
  const [searchRegex, setSearchRegex] = useState(false)

  const threadRef = useRef<MessageThreadHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activeUserMessageIndex, setActiveUserMessageIndex] = useState<number | undefined>(undefined)
  const [activeHeadingIndex, setActiveHeadingIndex] = useState<number | null>(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const workspaceId = useActiveConversationWorkspaceId()
  const { data: workspaces = [] } = useWorkspaces()

  // Derive workspaceRoot without storing intermediate objects in state
  const workspaceRoot = useMemo(
    () => workspaces.find((w) => w.id === workspaceId)?.path,
    [workspaces, workspaceId]
  )

  // ─── Streaming state ──────────────────────────────────────────────────────
  const { isRunning } = useAgentStream(activeConversationId)
  const messages = useMessagesWithStream(activeConversationId, activeBranchId)

  // Computed as a stable primitive — only changes when isRunning or last-message id changes
  const streamingMessageId = useMemo(() => {
    if (!isRunning) return undefined
    const last = messages[messages.length - 1]
    return last?.role === 'assistant' ? last.id : undefined
  }, [isRunning, messages])

  // ─── Heading extraction — completely decoupled from render ────────────────
  // Problem: the previous implementation called setHeadings/clearHeadings in a
  // useEffect that depended on `messages`, which fired on every new message and
  // called the assistant-messages store N times, causing N Zustand notifications,
  // each of which re-rendered every subscriber (all MessageBubbles).
  //
  // Fix: only call setHeadings/clearHeadings for messages whose content has
  // actually changed (tracked by content length), and batch all updates so the
  // store is only mutated once per effect run.
  const setHeadings = useAssistantMessageStore((s) => s.setHeadings)
  const clearHeadings = useAssistantMessageStore((s) => s.clearHeadings)

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.content || msg.id === '__streaming__') continue

      const cached = headingCache.get(msg.id)
      const contentLen = msg.content.length

      // Skip if we've already processed this exact content length
      if (cached?.contentLen === contentLen) continue

      const headings = extractHeadings(msg.content, msg.id)
      const hasHeadings = headings.length > 0
      headingCache.set(msg.id, { contentLen, hasHeadings })

      if (hasHeadings) setHeadings(msg.id, headings)
      else clearHeadings(msg.id)
    }
  }, [messages, setHeadings, clearHeadings])

  // Clean up heading cache entries for messages no longer in any conversation
  // (runs infrequently — only when activeConversationId changes)
  useEffect(() => {
    return () => {
      // On unmount or conversation switch, evict streaming placeholder
      headingCache.delete('__streaming__')
    }
  }, [activeConversationId])

  // ─── Conversation key ─────────────────────────────────────────────────────
  const activeKey = activeConversationId
    ? `${activeConversationId}_${activeBranchId ?? 'main'}`
    : undefined

  // ─── Save scroll token synchronously during render on conversation switch ─
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

  const initialScrollToken = useMemo(() => {
    if (!activeKey) return undefined
    const cached = scrollTokenCache.get(activeKey)
    if (!cached || typeof cached.messageId !== 'string') return undefined
    return cached
    // Re-derive only when the key changes (i.e. conversation switches)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  // ─── Jump-to-latest + unseen badge ───────────────────────────────────────
  const realMessageCount = useMemo(
    () => messages.filter((m) => m.id !== '__streaming__').length,
    [messages]
  )
  const messagesLengthRef = useRef(realMessageCount)
  messagesLengthRef.current = realMessageCount

  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [unseenCount, setUnseenCount] = useState(0)
  const lastSeenCountRef = useRef(realMessageCount)

  useEffect(() => {
    lastSeenCountRef.current = messagesLengthRef.current
    setUnseenCount(0)
    setShowJumpToLatest(false)
  }, [activeKey])

  useEffect(() => {
    if (isRunning) {
      lastSeenCountRef.current = messagesLengthRef.current
      setUnseenCount(0)
    }
  }, [isRunning])

  // ─── Scroll-to-message on external request ────────────────────────────────
  useEffect(() => {
    if (!scrollToMessageId || !messages.length) return
    const fullIndex = messages.findIndex((m) => m.id === scrollToMessageId)
    if (fullIndex === -1) return
    threadRef.current?.scrollToMessage(fullIndex)
    setHighlightedMessageId(scrollToMessageId)
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
    setScrollToMessageId(null)
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
  const lastMessagesRef = useRef(messages)
  lastMessagesRef.current = messages

  const jumpToLatest = useCallback(() => {
    const msgs = lastMessagesRef.current
    if (msgs.length === 0) return
    threadRef.current?.scrollToBottom()
    lastSeenCountRef.current = messagesLengthRef.current
    setUnseenCount(0)
    const lastMsg = msgs[msgs.length - 1]
    if (lastMsg) {
      setHighlightedMessageId(lastMsg.id)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
    }
    // No dep on `messages` — uses ref so callback is always stable
  }, [])

  // ─── Scroll settled ───────────────────────────────────────────────────────
  const handleScrollSettled = useCallback((token: ScrollToken) => {
    if (activeKeyRef.current) scrollTokenCache.set(activeKeyRef.current, token)
  }, [])

  // ─── Thread navigator ─────────────────────────────────────────────────────
  const handleVisibleUserIndexChange = useCallback((index: number) => {
    setActiveUserMessageIndex(index)
  }, [])

  const handleNavigatorScrollTo = useCallback((index: number) => {
    const msg = lastMessagesRef.current[index]
    if (!msg) return
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    setHighlightedMessageId(msg.id)
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
    threadRef.current?.scrollToMessage(index)
    // No dep on `messages` — uses ref
  }, [])

  // ─── Active heading tracking ──────────────────────────────────────────────
  // Stable refs to avoid re-subscribing the scroll listener on every render
  const activeUserMessageIndexRef = useRef(activeUserMessageIndex)
  activeUserMessageIndexRef.current = activeUserMessageIndex

  useEffect(() => {
    const unsub = threadRef.current?.onScroll(() => {
      const scrollContainer = threadRef.current?.getScrollElement()
      if (!scrollContainer || activeUserMessageIndexRef.current == null) return

      const assistantMsgId = lastMessagesRef.current[activeUserMessageIndexRef.current + 1]?.id
      if (!assistantMsgId) return

      const bubble = scrollContainer.querySelector(`[data-msg-id="${assistantMsgId}"]`)
      if (!bubble) return

      const headingEls = Array.from(bubble.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      if (!headingEls.length) return

      const containerTop = scrollContainer.getBoundingClientRect().top
      let activeIdx = 0
      for (let i = 0; i < headingEls.length; i++) {
        if (headingEls[i].getBoundingClientRect().top - containerTop <= 32) activeIdx = i
      }
      setActiveHeadingIndex((prev) => (prev === activeIdx ? prev : activeIdx))
    })
    return () => unsub?.()
    // Only re-subscribe when the conversation key changes (new thread handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  useEffect(() => { setActiveHeadingIndex(null) }, [activeUserMessageIndex])

  // ─── Heading click handler ────────────────────────────────────────────────
  const handleHeadingClick = useCallback((messageIndex: number, tocIndex: number) => {
    const msgs = lastMessagesRef.current
    const targetMsgId = msgs[messageIndex]?.id
    const scrollContainer = threadRef.current?.getScrollElement()

    const scrollToHeading = () => {
      requestAnimationFrame(() => {
        const container = threadRef.current?.getScrollElement()
        const bubble = container?.querySelector(`[data-msg-id="${targetMsgId}"]`)
        if (!bubble || !container) return
        const headingEls = bubble.querySelectorAll('h1,h2,h3,h4,h5,h6')
        const target = headingEls[tocIndex]
        if (!target) return
        const elTop = target.getBoundingClientRect().top
        const containerTop = container.getBoundingClientRect().top
        container.scrollTop += elTop - containerTop - 16
        const userMsgIndex = messageIndex - 1
        if (msgs[userMsgIndex]) handleVisibleUserIndexChange(userMsgIndex)
      })
    }

    const alreadyRendered = !!scrollContainer?.querySelector(`[data-msg-id="${targetMsgId}"]`)
    if (alreadyRendered) scrollToHeading()
    else threadRef.current?.scrollToMessage(messageIndex, scrollToHeading)
  }, [handleVisibleUserIndexChange])

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
  useEffect(() => { setSearchQuery('') }, [activeConversationId, setSearchQuery])

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
            className="pl-8 pr-24 h-8 text-sm"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchCaseSensitive((v) => !v)}
              className={cn(
                'p-0.5 rounded text-xs font-mono transition-colors',
                searchCaseSensitive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Case sensitive (Aa)"
            >
              Aa
            </button>
            <button
              type="button"
              onClick={() => setSearchRegex((v) => !v)}
              className={cn(
                'p-0.5 rounded text-xs font-mono transition-colors',
                searchRegex
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Regular expression (.*)"
            >
              .*
            </button>
            <KbdGroup className="hidden sm:flex ml-1">
              <Kbd>{modifierKey}</Kbd><Kbd>F</Kbd>
            </KbdGroup>
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

      {/* Message thread */}
      <div className="relative flex-1 min-h-0">
        <MessageThread
          ref={threadRef}
          conversationKey={activeKey ?? ''}
          messages={messages}
          streamingMessageId={streamingMessageId}
          searchQuery={debouncedSearch}
          searchCaseSensitive={searchCaseSensitive}
          searchRegex={searchRegex}
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
            activeHeadingIndex={activeHeadingIndex}
            onScrollTo={handleNavigatorScrollTo}
            onHeadingClick={handleHeadingClick}
          />
        )}

        {/* Jump to latest */}
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
