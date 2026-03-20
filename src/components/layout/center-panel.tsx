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

// ─── Scroll token cache ───────────────────────────────────────────────────────
// Keyed by `${conversationId}_${branchId ?? 'main'}`.
// Stores ID-based tokens: just the message ID of the topmost visible item.
// On restore we look up the message ID in filteredMessages and call scrollToIndex.
// This is immune to transient virtualizer state (mid-scroll measurements, etc.).
const scrollTokenCache = new Map<string, ScrollToken>()

export function CenterPanel() {
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const activeBranchId = useUIStore((s) => s.activeBranchId)
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
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const [activeUserMessageIndex, setActiveUserMessageIndex] = useState<number | undefined>(undefined)

  useAgentStream(activeConversationId)
  const messages = useMessagesWithStream(activeConversationId, activeBranchId)

  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Stable conversation key ─────────────────────────────────────────────
  const activeKeyRef = useRef<string | undefined>(undefined)
  const activeKey = activeConversationId
    ? `${activeConversationId}_${activeBranchId ?? 'main'}`
    : undefined

  // ─── SYNCHRONOUS token save on key change ────────────────────────────────
  // Runs during render (before the old MessageThread unmounts) so we capture
  // the token while the virtualizer's virtual items are still valid.
  if (activeKeyRef.current !== activeKey) {
    console.log(`[CenterPanel][keyChange] from="${activeKeyRef.current ?? 'none'}" to="${activeKey ?? 'none'}"`)

    if (activeKeyRef.current && threadRef.current) {
      const token = threadRef.current.getScrollToken()
      if (token) {
        console.log(`[CenterPanel][keyChange] 💾 saving token key="${activeKeyRef.current}" messageId=${token.messageId} scrollTop=${token.scrollTop}`)
        scrollTokenCache.set(activeKeyRef.current, token)
      } else {
        console.log(`[CenterPanel][keyChange] no token to save (thread empty or not mounted)`)
      }
    }

    activeKeyRef.current = activeKey
  }

  const initialScrollToken = (() => {
    if (!activeKey) return undefined
    const cached = scrollTokenCache.get(activeKey)
    // Guard against stale tokens from a previous format (e.g. { index, offsetFromTop })
    // that may be in the cache from a hot-reload or old session.
    if (!cached || typeof cached.messageId !== 'string' || typeof cached.scrollTop !== 'number') return undefined
    return cached
  })()

  console.log(`[CenterPanel][render] activeKey="${activeKey ?? 'none'}" token=${initialScrollToken?.messageId ?? 'none'} messageCount=${messages.length} showJumpToLatest=${showJumpToLatest} activeUserMessageIndex=${activeUserMessageIndex ?? 'none'}`)

  // ─── Visible user index ───────────────────────────────────────────────────
  const handleVisibleUserIndexChange = useCallback((index: number) => {
    console.log(`[CenterPanel][visibleUserIndex] reported fullIndex=${index}`)
    setActiveUserMessageIndex(index)
  }, [])

  // ─── ThreadNavigator scroll request ──────────────────────────────────────
  const handleNavigatorScrollTo = useCallback(
    (index: number) => {
      console.log(`[CenterPanel][navigatorScrollTo] fullIndex=${index} messages.length=${messages.length}`)
      const targetMessage = messages[index]
      if (!targetMessage) {
        console.warn(`[CenterPanel][navigatorScrollTo] no message at fullIndex=${index}`)
        return
      }
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      setHighlightedMessageId(targetMessage.id)
      highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
      threadRef.current?.scrollToMessage(index)
    },
    [messages]
  )

  // ─── Keyboard shortcut — ⌘F / Ctrl+F ─────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ─── Jump-to-latest button visibility ────────────────────────────────────
  // Event-driven via onScroll subscription — no polling interval.

  const messagesLengthRef = useRef(messages.length)
  messagesLengthRef.current = messages.length

  const computeShowJump = useCallback(() => {
    const t = threadRef.current
    if (!t) return
    const pos = t.getScrollPosition()
    const total = t.getTotalHeight()
    const client = t.getClientHeight()
    if (total <= client) {
      setShowJumpToLatest(false)
      return
    }
    const nearBottom = pos + client >= total - 100
    const next = !nearBottom && messagesLengthRef.current > 0
    setShowJumpToLatest((prev) => {
      if (prev !== next) {
        console.log(`[CenterPanel][jumpLatest] pos=${pos} total=${total} client=${client} nearBottom=${nearBottom} shouldShow=${next}`)
      }
      return next
    })
  }, [])

  useEffect(() => {
    const t = threadRef.current
    if (!t) return
    console.log('[CenterPanel][jumpLatest] subscribing to scroll events')
    const unsub = t.onScroll(computeShowJump)
    computeShowJump()
    return () => {
      console.log('[CenterPanel][jumpLatest] 🧹 unsubscribing')
      unsub()
    }
  }, [activeKey, computeShowJump])

  useEffect(() => {
    computeShowJump()
  }, [messages.length, computeShowJump])

  // ─── Clear search on conversation switch ─────────────────────────────────
  useEffect(() => {
    console.log(`[CenterPanel][searchReset] conversationId="${activeConversationId ?? 'none'}" — clearing search`)
    setSearchQuery('')
  }, [activeConversationId, setSearchQuery])

  // ─── Jump to latest ───────────────────────────────────────────────────────
  const jumpToLatest = () => {
    if (messages.length === 0) return
    const lastIndex = messages.length - 1
    console.log(`[CenterPanel][jumpToLatest] scrollToIndex(${lastIndex}, end, smooth)`)
    threadRef.current?.scrollToIndex(lastIndex, { behavior: 'smooth', align: 'end' })
    const lastMsg = messages[lastIndex]
    if (lastMsg) {
      setHighlightedMessageId(lastMsg.id)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
    }
  }

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
            <KbdGroup>
              <Kbd>{modifierKey}</Kbd>
              <Kbd>F</Kbd>
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
            onChange={(e) => {
              console.log(`[CenterPanel][autoScroll] toggled to ${e.target.checked}`)
              setAutoScroll(e.target.checked)
            }}
            className="size-3 accent-primary cursor-pointer"
          />
          Auto-scroll
        </label>
      </div>

      <div className="relative flex-1 min-h-0">
        <MessageThread
          key={activeKey}
          ref={threadRef}
          messages={messages}
          searchQuery={debouncedSearch}
          highlightedMessageId={highlightedMessageId}
          initialScrollToken={initialScrollToken}
          autoScroll={autoScroll}
          onVisibleUserIndexChange={handleVisibleUserIndexChange}
        />

        {messages.length > 2 && (
          <ThreadNavigator
            messages={messages}
            activeIndex={activeUserMessageIndex}
            onScrollTo={handleNavigatorScrollTo}
          />
        )}

        <button
          type="button"
          onClick={jumpToLatest}
          className={cn(
            'absolute bottom-4 right-4 z-30 flex items-center justify-center w-8 h-8 rounded-full bg-background border border-border shadow-md transition-all duration-200 hover:bg-accent/10 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            showJumpToLatest
              ? 'opacity-100 visible pointer-events-auto'
              : 'opacity-0 invisible pointer-events-none'
          )}
          aria-label="Jump to latest message"
          title="Jump to latest"
        >
          <ArrowDown className="size-4" />
        </button>
      </div>

      <div className="shrink-0 border-t border-border">
        <MessageInput conversationId={activeConversationId} workspaceRoot={workspaceRoot} />
      </div>
    </div>
  )
}
