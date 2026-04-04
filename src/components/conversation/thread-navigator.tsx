// src/components/conversation/thread-navigator.tsx
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, ChevronRight } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBookmarks } from '@/hooks/use-bookmarks'
import type { HeadingItem, MessageData } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useConversationStore } from '@/store/conversation'

const VISIBLE_ITEMS = 10
const DOT_HEIGHT = 20

interface ThreadNavigatorProps {
  messages: MessageData[]
  activeIndex?: number
  activeHeadingIndex?: number | null
  onScrollTo: (index: number) => void
  onHeadingClick: (messageIndex: number, tocIndex: number) => void
  headings: HeadingItem[]
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

const ThreadNavigator = memo(function ThreadNavigator({
  messages,
  activeIndex = -1,
  activeHeadingIndex = null,
  onScrollTo,
  onHeadingClick,
  headings,
}: ThreadNavigatorProps) {
  const userMessages = useMemo(
    () =>
      messages
        .map((msg, idx) => ({ msg, idx }))
        .filter(({ msg }) => msg.role === 'user'),
    [messages]
  )

  const headingsByMessage = useMemo(() => {
    const map = new Map<string, HeadingItem[]>()
    for (const h of headings) {
      if (!map.has(h.message_id)) map.set(h.message_id, [])
      map.get(h.message_id)!.push(h)
    }
    return map
  }, [headings])

  const hasMessages = userMessages.length > 0

  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId
  )
  const { data: convBookmarks = [] } = useBookmarks(activeConversationId)

  const assistantHasBookmark = useCallback(
    (assistantMsgId: string | undefined) =>
      !!assistantMsgId && convBookmarks.some((b) => b.message_id === assistantMsgId),
    [convBookmarks]
  )

  const headingIsBookmarked = useCallback(
    (assistantMsgId: string | undefined, anchor: string) =>
      !!assistantMsgId &&
      convBookmarks.some(
        (b) => b.message_id === assistantMsgId && b.heading_anchor === anchor
      ),
    [convBookmarks]
  )

  const [windowStart, setWindowStart] = useState(0)
  const total = userMessages.length

  useEffect(() => {
    if (!hasMessages) return
    if (total <= VISIBLE_ITEMS) { setWindowStart(0); return }
    const cur = userMessages.findIndex((u) => u.idx === activeIndex)
    if (cur === -1) return
    const isOutside = cur < windowStart || cur >= windowStart + VISIBLE_ITEMS
    if (isOutside) {
      const half = Math.floor(VISIBLE_ITEMS / 2)
      setWindowStart(clamp(cur - half, 0, total - VISIBLE_ITEMS))
    }
  }, [activeIndex, userMessages, windowStart, hasMessages, total])

  useEffect(() => {
    if (!hasMessages) return
    if (total <= VISIBLE_ITEMS) setWindowStart(0)
    else setWindowStart((prev) => Math.min(prev, total - VISIBLE_ITEMS))
  }, [total, hasMessages])

  const visibleCount = hasMessages ? Math.min(total, VISIBLE_ITEMS) : 0
  const containerHeight = visibleCount * DOT_HEIGHT
  const translateY = -windowStart * DOT_HEIGHT

  const [expandedMsgIdx, setExpandedMsgIdx] = useState<number | null>(null)
  const toggleToc = useCallback((msgIdx: number, expand: boolean) => {
    setExpandedMsgIdx(expand ? msgIdx : null)
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(0)
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map())
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissingRef = useRef(false)

  // Position card once when opening – to the left of the dot rail (above it)
  useEffect(() => {
    if (!isOpen || !containerRef.current) {
      setCardPosition(null)
      return
    }
    const railRect = containerRef.current.getBoundingClientRect()
    const cardWidth = 264
    const gap = 8
    // Place to the left of the rail (above in layout)
    let left = railRect.left - cardWidth - gap
    // If too far left, place to the right
    if (left < 8) {
      left = railRect.right + gap
    }
    // Keep within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - cardWidth - 8))
    const top = railRect.top + railRect.height / 2
    setCardPosition({ top, left })
  }, [isOpen])

  useEffect(() => () => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
  }, [])

  const closeCard = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    dismissingRef.current = true
    setTimeout(() => { dismissingRef.current = false }, 400)
    setIsOpen(false)
    setExpandedMsgIdx(null)
    setCardPosition(null)
  }, [])

  const openCard = useCallback((startFocusIdx = 0) => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setFocusedIdx(startFocusIdx)
    setIsOpen(true)
  }, [])

  const onRailMouseEnter = () => {
    if (dismissingRef.current) return
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    enterTimer.current = setTimeout(() => setIsOpen(true), 100)
  }

  const onRailMouseLeave = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => setIsOpen(false), 300)
  }

  const onCardMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
  }

  const onCardMouseLeave = () => {
    leaveTimer.current = setTimeout(() => setIsOpen(false), 300)
  }

  type NavItem =
    | { kind: 'message'; msgIdx: number; listIdx: number }
    | { kind: 'heading'; assistantMsgIdx: number; tocIndex: number; parentListIdx: number; headingId: string }

  const { navItems, headingNavMap } = useMemo(() => {
    const items: NavItem[] = []
    const map = new Map<string, number>()

    userMessages.forEach(({ idx }, listIdx) => {
      items.push({ kind: 'message', msgIdx: idx, listIdx })
      if (expandedMsgIdx === idx) {
        const assistantId = messages[idx + 1]?.id
        const hs = assistantId ? (headingsByMessage.get(assistantId) ?? []) : []
        hs.forEach((h) => {
          const navIdx = items.length
          map.set(`${assistantId}-${h.id}`, navIdx)
          items.push({ kind: 'heading', assistantMsgIdx: idx + 1, tocIndex: h.toc_index, parentListIdx: listIdx, headingId: h.id })
        })
      }
    })

    return { navItems: items, headingNavMap: map }
  }, [userMessages, expandedMsgIdx, messages, headingsByMessage])

  const focusItem = useCallback((idx: number) => {
    setFocusedIdx(idx)
    requestAnimationFrame(() => {
      const el = itemRefs.current.get(idx)
      if (!el || !scrollRef.current) return
      const cr = scrollRef.current.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollTop + er.top - cr.top - cr.height / 2 + er.height / 2,
        behavior: 'auto',
      })
      el.focus({ preventScroll: true })
    })
  }, [])

  useEffect(() => {
    if (!isOpen || !scrollRef.current) return
    if (activeIndex === -1) return
    const el = scrollRef.current.querySelector(
      `[data-message-idx="${activeIndex}"]`
    ) as HTMLElement | null
    if (el) {
      const cr = scrollRef.current.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollTop + er.top - cr.top - cr.height / 2 + er.height / 2,
        behavior: 'auto',
      })
    }
  }, [isOpen, activeIndex])

  const stateRef = useRef({ isOpen, focusedIdx, navItems, expandedMsgIdx, userMessages, messages, headingsByMessage, activeIndex })
  stateRef.current = { isOpen, focusedIdx, navItems, expandedMsgIdx, userMessages, messages, headingsByMessage, activeIndex }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      const s = stateRef.current

      if (!s.isOpen) {
        if (e.key === 'j' || e.key === 'J') {
          e.preventDefault()
          const cur = s.userMessages.findIndex((u) => u.idx === s.activeIndex)
          const next = Math.min(s.userMessages.length - 1, cur + 1)
          if (next !== cur) onScrollTo(s.userMessages[next].idx)
          return
        }
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault()
          const cur = s.userMessages.findIndex((u) => u.idx === s.activeIndex)
          const prev = Math.max(0, cur - 1)
          if (prev !== cur) onScrollTo(s.userMessages[prev].idx)
          return
        }
        if (e.key === '?') {
          e.preventDefault()
          const curListIdx = Math.max(0, s.userMessages.findIndex((u) => u.idx === s.activeIndex))
          const startNavIdx = s.navItems.findIndex((n) => n.kind === 'message' && n.listIdx === curListIdx)
          openCard(Math.max(0, startNavIdx))
          return
        }
        return
      }

      const cur = s.focusedIdx
      const total = s.navItems.length

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          closeCard()
          break
        case 'ArrowDown':
        case 'j':
          e.preventDefault()
          focusItem(clamp(cur + 1, 0, total - 1))
          break
        case 'ArrowUp':
        case 'k':
          e.preventDefault()
          focusItem(clamp(cur - 1, 0, total - 1))
          break
        case 'Home':
          e.preventDefault()
          focusItem(0)
          break
        case 'End':
          e.preventDefault()
          focusItem(total - 1)
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          const item = s.navItems[cur]
          if (!item) break
          if (item.kind === 'message') {
            const assistantId = s.messages[item.msgIdx + 1]?.id
            const hs = assistantId ? (s.headingsByMessage.get(assistantId) ?? []) : []
            if (hs.length > 0 && s.expandedMsgIdx !== item.msgIdx) {
              toggleToc(item.msgIdx, true)
            } else {
              onScrollTo(item.msgIdx)
              closeCard()
            }
          } else {
            onHeadingClick(item.assistantMsgIdx, item.tocIndex)
            closeCard()
          }
          break
        }
        case 'ArrowRight':
        case 'l': {
          e.preventDefault()
          const item = s.navItems[cur]
          if (item?.kind !== 'message') break
          const assistantId = s.messages[item.msgIdx + 1]?.id
          const hs = assistantId ? (s.headingsByMessage.get(assistantId) ?? []) : []
          if (hs.length > 0 && s.expandedMsgIdx !== item.msgIdx) toggleToc(item.msgIdx, true)
          break
        }
        case 'ArrowLeft':
        case 'h': {
          e.preventDefault()
          const item = s.navItems[cur]
          if (item?.kind === 'heading') {
            toggleToc(item.assistantMsgIdx - 1, false)
            const parentNavIdx = s.navItems.findIndex((n) => n.kind === 'message' && n.listIdx === item.parentListIdx)
            if (parentNavIdx !== -1) focusItem(parentNavIdx)
          } else if (item?.kind === 'message' && s.expandedMsgIdx === item.msgIdx) {
            toggleToc(item.msgIdx, false)
          }
          break
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeCard, openCard, focusItem, toggleToc, onScrollTo, onHeadingClick])

  useEffect(() => {
    if (!isOpen) return
    const el = itemRefs.current.get(focusedIdx)
    if (el) {
      requestAnimationFrame(() => el.focus({ preventScroll: true }))
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (cardRef.current?.contains(t) || containerRef.current?.contains(t)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isOpen])

  if (!hasMessages) return null

  return (
    <>
      {/* Dot rail – always visible */}
      <nav
        ref={containerRef}
        aria-label="Thread navigation"
        className="absolute left-2 top-0 bottom-0 flex flex-col justify-center z-20"
        onMouseEnter={onRailMouseEnter}
        onMouseLeave={onRailMouseLeave}
      >
        <div
          className="relative overflow-hidden pr-1 py-1"
          style={{ height: containerHeight }}
        >
          <div
            className="flex flex-col gap-1"
            style={{ transform: `translateY(${translateY}px)` }}
          >
            {userMessages.map(({ msg, idx }) => {
              const isActive = idx === activeIndex && activeIndex !== -1
              const assistantId = messages[idx + 1]?.id
              const hasBookmarks = assistantHasBookmark(assistantId)

              return (
                <button
                  key={msg.id}
                  type="button"
                  className="group relative w-4 h-4 flex items-center justify-center pointer-events-auto"
                  onClick={() => onScrollTo(idx)}
                  aria-label={`Jump to message ${userMessages.findIndex((u) => u.idx === idx) + 1}`}
                >
                  <div className="w-3 h-[3px] flex items-center justify-start">
                    <div
                      className={cn(
                        'h-[2px] w-3 rounded-full origin-left transition-all duration-150',
                        isActive
                          ? 'bg-primary scale-x-100 scale-y-150 opacity-100'
                          : 'bg-muted-foreground/30 group-hover:bg-primary/60 scale-x-60 scale-y-100 opacity-50'
                      )}
                    />
                  </div>
                  <AnimatePresence>
                    {hasBookmarks && (
                      <motion.span
                        key="bookmark-dot"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-background"
                        aria-hidden
                      />
                    )}
                  </AnimatePresence>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {createPortal(
        <AnimatePresence mode="wait">
          {isOpen && cardPosition && (
            <motion.div
              key="nav-card"
              ref={cardRef}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 w-64 p-2 bg-popover rounded-lg border shadow-md flex flex-col"
              style={{
                top: cardPosition.top,
                left: cardPosition.left,
                transform: 'translateY(-50%)',
                maxHeight: 'min(380px, 70vh)',
              }}
              onMouseEnter={onCardMouseEnter}
              onMouseLeave={onCardMouseLeave}
            >
              {/* Help hint */}
              <div className="flex items-center px-1 pb-1.5 mb-1 border-b border-border/50">
                <span className="text-[10px] text-muted-foreground/50 font-mono leading-none">
                  ↑↓ move · ↵ jump · → expand · Esc close
                </span>
              </div>

              {/* Scrollable list */}
              <div ref={scrollRef} className="overflow-y-auto thin-scrollbar flex-1 min-h-0">
                <div className="space-y-0.5 pr-1">
                  {userMessages.map(({ msg, idx }, listIdx) => {
                    const isActive = idx === activeIndex
                    const assistantMsgIdx = idx + 1
                    const assistantId = messages[assistantMsgIdx]?.id
                    const hs = assistantId ? (headingsByMessage.get(assistantId) ?? []) : []
                    const hasHeadings = hs.length > 0
                    const isExpanded = expandedMsgIdx === idx
                    const hasAnyBookmark = assistantHasBookmark(assistantId)
                    const msgLevelBookmark = assistantId
                      ? convBookmarks.some((b) => b.message_id === assistantId && !b.heading_anchor)
                      : false

                    const msgNavIdx = navItems.findIndex(
                      (n) => n.kind === 'message' && n.listIdx === listIdx
                    )
                    const isFocused = focusedIdx === msgNavIdx

                    return (
                      <div key={msg.id} data-message-idx={idx}>
                        <div className="flex items-center gap-0.5">
                          <button
                            ref={(el) => {
                              if (el) itemRefs.current.set(msgNavIdx, el)
                              else itemRefs.current.delete(msgNavIdx)
                            }}
                            type="button"
                            tabIndex={-1}
                            className={cn(
                              'group flex items-center gap-2 flex-1 text-left px-1.5 py-1 rounded transition-colors min-w-0 outline-none',
                              isFocused ? 'bg-muted/60' : 'hover:bg-muted/40'
                            )}
                            onClick={() => { onScrollTo(idx); closeCard() }}
                            onMouseEnter={() => setFocusedIdx(msgNavIdx)}
                            onFocus={() => setFocusedIdx(msgNavIdx)}
                          >
                            <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                              <div
                                className={cn(
                                  'h-[2px] rounded-full transition-all duration-150',
                                  isActive ? 'w-3 bg-primary' : 'w-2 bg-muted-foreground/30 group-hover:bg-primary/60'
                                )}
                              />
                            </div>
                            <p
                              className={cn(
                                'text-xs truncate flex-1 transition-colors duration-150',
                                isActive ? 'text-foreground font-medium' : 'text-muted-foreground group-hover:text-foreground'
                              )}
                            >
                              {msg.content}
                            </p>
                            {hasAnyBookmark && (
                              <Bookmark
                                className={cn(
                                  'flex-shrink-0 transition-colors',
                                  msgLevelBookmark
                                    ? 'size-3 text-amber-500 fill-amber-500'
                                    : 'size-2.5 text-amber-400/80 fill-amber-400/30'
                                )}
                              />
                            )}
                          </button>

                          {hasHeadings && (
                            <button
                              type="button"
                              tabIndex={-1}
                              className="flex-shrink-0 p-1 rounded transition-colors outline-none text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              onClick={() => toggleToc(idx, !isExpanded)}
                              aria-label={isExpanded ? 'Collapse headings' : 'Expand headings'}
                              aria-expanded={isExpanded}
                            >
                              <motion.div
                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                transition={{ duration: 0.15 }}
                              >
                                <ChevronRight className="size-3" />
                              </motion.div>
                            </button>
                          )}
                        </div>

                        <AnimatePresence initial={false}>
                          {isExpanded && hasHeadings && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-3 mt-0.5 mb-1.5 border-l-2 border-primary/20 pl-2 space-y-px">
                                {hs.map((h) => {
                                  const hBookmarked = headingIsBookmarked(assistantId, h.id)
                                  const isActiveHeading = isActive && h.toc_index === activeHeadingIndex
                                  const headingNavIdx = headingNavMap.get(`${assistantId}-${h.id}`) ?? -1
                                  const isHFocused = focusedIdx === headingNavIdx
                                  const isH1 = h.level === 1
                                  const isH2 = h.level === 2

                                  return (
                                    <button
                                      key={`${assistantId}-${h.id}`}
                                      ref={(el) => {
                                        if (el) itemRefs.current.set(headingNavIdx, el)
                                        else itemRefs.current.delete(headingNavIdx)
                                      }}
                                      type="button"
                                      tabIndex={-1}
                                      data-heading-idx={h.toc_index}
                                      className={cn(
                                        'flex w-full items-center text-left rounded transition-colors group outline-none py-0.5',
                                        isHFocused && 'bg-muted/60'
                                      )}
                                      style={{ paddingLeft: `${(h.level - 1) * 8 + 6}px` }}
                                      onClick={() => { onHeadingClick(assistantMsgIdx, h.toc_index); closeCard() }}
                                      onMouseEnter={() => { if (headingNavIdx !== -1) setFocusedIdx(headingNavIdx) }}
                                      onFocus={() => { if (headingNavIdx !== -1) setFocusedIdx(headingNavIdx) }}
                                    >
                                      <span
                                        className={cn(
                                          'inline-block flex-shrink-0 self-center rounded-full mr-1.5 transition-colors',
                                          hBookmarked
                                            ? 'bg-amber-400 w-1.5 h-1.5'
                                            : cn(
                                              isActiveHeading ? 'bg-primary' : 'bg-muted-foreground/20 group-hover:bg-primary/40',
                                              isH1 ? 'w-1 h-1' : 'w-0.5 h-0.5',
                                              !isH1 && !isH2 && 'opacity-60'
                                            )
                                        )}
                                      />
                                      <span
                                        className={cn(
                                          'truncate flex-1 transition-colors',
                                          !isActiveHeading && 'group-hover:text-foreground',
                                          isH1 ? 'text-xs font-medium' : isH2 ? 'text-xs' : 'text-[11px]',
                                          isActiveHeading
                                            ? 'text-primary font-medium'
                                            : isH1
                                              ? 'text-muted-foreground'
                                              : isH2
                                                ? 'text-muted-foreground/80'
                                                : 'text-muted-foreground/60'
                                        )}
                                      >
                                        {h.text}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
})

export default ThreadNavigator
