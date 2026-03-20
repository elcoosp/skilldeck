/**
 * Center panel — virtualized message thread and input bar.
 *
 * Scroll restoration: CenterPanel saves the raw scrollTop pixel offset
 * in a module-level Map during render (when the conversation key changes).
 * This happens synchronously before React remounts the child, so threadRef
 * still points to the old instance and getScrollPosition() returns the real value.
 * The saved offset is passed as initialScrollOffset to the new MessageThread,
 * which sets scrollRef.current.scrollTop directly in a useLayoutEffect —
 * before first paint, no effects race, no StrictMode issues.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { ChevronDown, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { BranchNav } from '@/components/conversation/branch-nav'
import { MessageInput } from '@/components/conversation/message-input'
import {
  MessageThread,
  type MessageThreadHandle
} from '@/components/conversation/message-thread'
import { ThreadNavigator } from '@/components/conversation/thread-navigator'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { useActiveConversationWorkspaceId } from '@/hooks/use-conversations'
import { useMessagesWithStream } from '@/hooks/use-messages'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { useUIStore } from '@/store/ui'

// Module-level — survives conversation switches, cleared only on page reload.
const scrollOffsetCache = new Map<string, number>()

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

  const threadRef = useRef<MessageThreadHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)

  useAgentStream(activeConversationId)
  const messages = useMessagesWithStream(activeConversationId, activeBranchId)

  const [activeUserMessageIndex, setActiveUserMessageIndex] = useState<number | undefined>(undefined)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Scroll save/restore ────────────────────────────────────────────────
  const activeKeyRef = useRef<string | undefined>(undefined)
  const activeKey = activeConversationId
    ? `${activeConversationId}_${activeBranchId ?? 'main'}`
    : undefined

  // This runs during render — synchronously — before React processes the key change
  // that will remount MessageThread. threadRef still points to the OLD instance here.
  if (activeKeyRef.current !== activeKey) {
    if (activeKeyRef.current && threadRef.current) {
      const pos = threadRef.current.getScrollPosition()
      if (pos > 0 || !scrollOffsetCache.has(activeKeyRef.current)) {
        scrollOffsetCache.set(activeKeyRef.current, pos)
      }
    }
    activeKeyRef.current = activeKey
  }

  const initialScrollOffset = activeKey ? scrollOffsetCache.get(activeKey) : undefined

  // ── Rest of panel ──────────────────────────────────────────────────────
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

  const handleVisibleUserIndexChange = useCallback((index: number) => {
    setActiveUserMessageIndex(index)
  }, [])

  const scrollToMessage = useCallback((index: number) => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    const targetMessage = messages[index]
    if (targetMessage) {
      setHighlightedMessageId(targetMessage.id)
      highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
    }
    threadRef.current?.scrollToMessage(index)
  }, [messages])

  const checkScrollPosition = useCallback(() => {
    if (!threadRef.current) return
    const pos = threadRef.current.getScrollPosition()
    const totalHeight = threadRef.current.getTotalHeight()
    const clientHeight = threadRef.current.getClientHeight()
    if (totalHeight <= clientHeight) { setShowJumpToLatest(false); return }
    setShowJumpToLatest(pos + clientHeight < totalHeight - 100 && messages.length > 0)
  }, [messages.length])

  useEffect(() => {
    const interval = setInterval(checkScrollPosition, 200)
    return () => clearInterval(interval)
  }, [checkScrollPosition])

  useEffect(() => { checkScrollPosition() }, [messages, checkScrollPosition])

  useEffect(() => { setSearchQuery('') }, [activeConversationId, setSearchQuery])

  useEffect(() => () => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
  }, [])

  const modifierKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'

  const jumpToLatest = () => {
    if (messages.length === 0) return
    threadRef.current?.scrollToIndex(messages.length - 1, { behavior: 'smooth' })
    const lastMsg = messages[messages.length - 1]
    if (lastMsg) {
      setHighlightedMessageId(lastMsg.id)
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 800)
    }
  }

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
      </div>

      <div className="relative flex-1 min-h-0">
        <MessageThread
          key={activeKey}
          ref={threadRef}
          messages={messages}
          searchQuery={debouncedSearch}
          onVisibleUserIndexChange={handleVisibleUserIndexChange}
          highlightedMessageId={highlightedMessageId}
          initialScrollOffset={initialScrollOffset}
        />

        {messages.length > 2 && (
          <ThreadNavigator
            messages={messages}
            onScrollTo={scrollToMessage}
            activeIndex={activeUserMessageIndex}
          />
        )}

        {showJumpToLatest && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-4 right-4 z-30 flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Jump to latest message"
            title="Jump to latest"
          >
            <ChevronDown className="size-5" />
          </button>
        )}
      </div>

      <div className="shrink-0 border-t border-border">
        <MessageInput conversationId={activeConversationId} workspaceRoot={workspaceRoot} />
      </div>
    </div>
  )
}
