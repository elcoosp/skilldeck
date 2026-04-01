// src/components/conversation/thread-navigator.tsx
// (full file with fixed dependencies)

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

type NavItem =
  | { kind: 'message'; msgIdx: number; listIdx: number }
  | {
      kind: 'heading'
      assistantMsgIdx: number
      tocIndex: number
      parentListIdx: number
      headingId: string
    }

const ThreadNavigator = memo(function ThreadNavigator({
  messages,
  activeIndex = -1,
  activeHeadingIndex = null,
  onScrollTo,
  onHeadingClick,
  headings
}: ThreadNavigatorProps) {
  const userMessages = useMemo(
    () =>
      messages
        .map((msg, idx) => ({ msg, idx }))
        .filter(({ msg }) => msg.role === 'user'),
    [messages]
  )

  // Build a map of message_id -> headings array
  const headingsByMessage = useMemo(() => {
    const map = new Map<string, HeadingItem[]>()
    for (const h of headings) {
      if (!map.has(h.message_id)) map.set(h.message_id, [])
      map.get(h.message_id)!.push(h)
    }
    return map
  }, [headings])

  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId
  )
  const { data: convBookmarks = [] } = useBookmarks(activeConversationId)

  const hasMessages = userMessages.length > 0

  const [optimisticActiveIndex, setOptimisticActiveIndex] = useState<
    number | null
  >(null)
  const effectiveActiveIndex = optimisticActiveIndex ?? activeIndex

  // Sliding window
  const [windowStart, setWindowStart] = useState(0)

  useEffect(() => {
    if (!hasMessages) return
    const total = userMessages.length
    if (total <= VISIBLE_ITEMS) {
      setWindowStart(0)
      return
    }
    const currentIdx = userMessages.findIndex(
      (u) => u.idx === effectiveActiveIndex
    )
    if (currentIdx === -1) return
    const isOutside =
      currentIdx < windowStart || currentIdx >= windowStart + VISIBLE_ITEMS
    if (isOutside) {
      const half = Math.floor(VISIBLE_ITEMS / 2)
      setWindowStart(
        Math.max(0, Math.min(total - VISIBLE_ITEMS, currentIdx - half))
      )
    }
  }, [effectiveActiveIndex, userMessages, windowStart, hasMessages])

  useEffect(() => {
    if (!hasMessages) return
    const total = userMessages.length
    if (total <= VISIBLE_ITEMS) setWindowStart(0)
    else setWindowStart((prev) => Math.min(prev, total - VISIBLE_ITEMS))
  }, [userMessages.length, hasMessages])

  const translateY = -windowStart * DOT_HEIGHT
  const visibleCount = hasMessages
    ? Math.min(userMessages.length, VISIBLE_ITEMS)
    : 0
  const containerHeight = visibleCount * DOT_HEIGHT

  // TOC expand state
  const [expandedTocIdx, setExpandedTocIdx] = useState<number | null>(null)
  const userCollapsedMessages = useRef<Set<number>>(new Set())

  const handleToggleToc = useCallback((messageIdx: number, expand: boolean) => {
    if (!expand) userCollapsedMessages.current.add(messageIdx)
    else userCollapsedMessages.current.delete(messageIdx)
    setExpandedTocIdx(expand ? messageIdx : null)
  }, [])

  // Build flat nav list and a map from heading identifier to its nav index
  const { navItems, headingNavIndexMap } = useMemo(() => {
    const items: NavItem[] = []
    const map = new Map<string, number>() // key: `${assistantMsgId}-${heading.id}`

    userMessages.forEach(({ idx }, listIdx) => {
      // Add message item
      items.push({ kind: 'message', msgIdx: idx, listIdx })

      // If expanded, add headings
      if (expandedTocIdx === idx) {
        const assistantMsgId = messages[idx + 1]?.id
        const headings = assistantMsgId
          ? (headingsByMessage.get(assistantMsgId) ?? [])
          : []
        headings.forEach((h) => {
          const navIdx = items.length
          const uniqueKey = `${assistantMsgId}-${h.id}`
          map.set(uniqueKey, navIdx)
          items.push({
            kind: 'heading',
            assistantMsgIdx: idx + 1,
            tocIndex: h.toc_index,
            parentListIdx: listIdx,
            headingId: h.id
          })
        })
      }
    })

    return { navItems: items, headingNavIndexMap: map }
  }, [userMessages, expandedTocIdx, messages, headingsByMessage])

  // Keyboard state
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [focusedNavIdx, setFocusedNavIdx] = useState(0)
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map())

  // Hover card
  const [isHovering, setIsHovering] = useState(false)
  const [cardPosition, setCardPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const prevActiveIndexRef = useRef(effectiveActiveIndex)
  const prevActiveHeadingIndexRef = useRef(activeHeadingIndex)

  const isCardOpen = isHovering || isKeyboardOpen

  // Stable refs for keyboard handler
  const stateRef = useRef({
    isCardOpen,
    isKeyboardOpen,
    focusedNavIdx,
    navItems,
    effectiveActiveIndex,
    userMessages,
    expandedTocIdx,
    headingsByMessage,
    messages
  })
  stateRef.current = {
    isCardOpen,
    isKeyboardOpen,
    focusedNavIdx,
    navItems,
    effectiveActiveIndex,
    userMessages,
    expandedTocIdx,
    headingsByMessage,
    messages
  }

  const scrollCardToElement = useCallback((el: HTMLElement) => {
    const container = scrollContainerRef.current
    if (!container) return
    const cr = container.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    container.scrollTo({
      top:
        container.scrollTop + er.top - cr.top - cr.height / 2 + er.height / 2,
      behavior: 'auto'
    })
  }, [])

  // Auto-scroll card to active item when active changes
  useEffect(() => {
    if (!isCardOpen || !cardPosition || !scrollContainerRef.current) return
    const activeChanged =
      prevActiveIndexRef.current !== effectiveActiveIndex ||
      prevActiveHeadingIndexRef.current !== activeHeadingIndex
    if (!activeChanged) return
    prevActiveIndexRef.current = effectiveActiveIndex
    prevActiveHeadingIndexRef.current = activeHeadingIndex
    if (activeHeadingIndex !== null) {
      const el = scrollContainerRef.current.querySelector(
        `[data-heading-idx="${activeHeadingIndex}"]`
      ) as HTMLElement | null
      if (el) {
        scrollCardToElement(el)
        return
      }
    }
    if (effectiveActiveIndex !== -1) {
      const el = scrollContainerRef.current.querySelector(
        `[data-message-idx="${effectiveActiveIndex}"]`
      ) as HTMLElement | null
      if (el) scrollCardToElement(el)
    }
  }, [
    isCardOpen,
    cardPosition,
    effectiveActiveIndex,
    activeHeadingIndex,
    scrollCardToElement
  ])

  // Card position
  useEffect(() => {
    if (!isCardOpen || !containerRef.current || !hasMessages) {
      setCardPosition(null)
      return
    }
    const update = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const cardWidth = 264
      let left = rect.left
      if (left > window.innerWidth - cardWidth - 16)
        left = window.innerWidth - cardWidth - 16
      setCardPosition({ top: rect.top + rect.height / 2, left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [isCardOpen, hasMessages])

  // Timers cleanup
  useEffect(
    () => () => {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    },
    []
  )

  const isDismissingRef = useRef(false)

  const handleMouseEnter = () => {
    if (stateRef.current.isKeyboardOpen) return
    if (isDismissingRef.current) return
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    enterTimer.current = setTimeout(() => setIsHovering(true), 100)
  }
  const handleMouseLeave = () => {
    if (stateRef.current.isKeyboardOpen) return
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => setIsHovering(false), 300)
  }

  const handleClick = useCallback(
    (idx: number) => {
      setOptimisticActiveIndex(idx)
      onScrollTo(idx)
    },
    [onScrollTo]
  )

  useEffect(() => {
    if (optimisticActiveIndex !== null && activeIndex === optimisticActiveIndex)
      setOptimisticActiveIndex(null)
  }, [activeIndex, optimisticActiveIndex])

  const handleHeadingClickInner = useCallback(
    (assistantMsgIdx: number, tocIndex: number) => {
      const messageIdx = assistantMsgIdx - 1
      if (stateRef.current.expandedTocIdx !== messageIdx) {
        userCollapsedMessages.current.delete(messageIdx)
        setExpandedTocIdx(messageIdx)
      }
      onHeadingClick(assistantMsgIdx, tocIndex)
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
      isDismissingRef.current = true
      setTimeout(() => {
        isDismissingRef.current = false
      }, 400)
      setIsHovering(false)
      setIsKeyboardOpen(false)
    },
    [onHeadingClick]
  )

  const closeCard = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    isDismissingRef.current = true
    setTimeout(() => {
      isDismissingRef.current = false
    }, 400)
    setIsHovering(false)
    setIsKeyboardOpen(false)
  }, [])

  const focusNavItem = useCallback(
    (idx: number) => {
      setFocusedNavIdx(idx)
      requestAnimationFrame(() => {
        const el = itemRefs.current.get(idx)
        if (el) {
          el.focus({ preventScroll: true })
          scrollCardToElement(el)
        }
      })
    },
    [scrollCardToElement]
  )

  // Keyboard handler (unchanged logic, now with correct dependencies)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
        return

      const s = stateRef.current

      if (!s.isCardOpen) {
        if (e.key === 'j' || e.key === 'J') {
          e.preventDefault()
          const cur = s.userMessages.findIndex(
            (u) => u.idx === s.effectiveActiveIndex
          )
          const next = Math.min(s.userMessages.length - 1, cur + 1)
          if (next !== cur) handleClick(s.userMessages[next].idx)
          return
        }
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault()
          const cur = s.userMessages.findIndex(
            (u) => u.idx === s.effectiveActiveIndex
          )
          const prev = Math.max(0, cur - 1)
          if (prev !== cur) handleClick(s.userMessages[prev].idx)
          return
        }
        if (e.key === '?') {
          e.preventDefault()
          const activeListIdx = Math.max(
            0,
            s.userMessages.findIndex((u) => u.idx === s.effectiveActiveIndex)
          )
          const navIdx = s.navItems.findIndex(
            (n) => n.kind === 'message' && n.listIdx === activeListIdx
          )
          const startIdx = Math.max(0, navIdx)
          if (enterTimer.current) clearTimeout(enterTimer.current)
          if (leaveTimer.current) clearTimeout(leaveTimer.current)
          setFocusedNavIdx(startIdx)
          setIsKeyboardOpen(true)
        }
        return
      }

      const cur = s.focusedNavIdx
      const total = s.navItems.length

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          closeCard()
          break
        case 'ArrowDown':
        case 'j':
          e.preventDefault()
          focusNavItem(Math.min(total - 1, cur + 1))
          break
        case 'ArrowUp':
        case 'k':
          e.preventDefault()
          focusNavItem(Math.max(0, cur - 1))
          break
        case 'Home':
          e.preventDefault()
          focusNavItem(0)
          break
        case 'End':
          e.preventDefault()
          focusNavItem(total - 1)
          break
        case 'Enter':
        case ' ': {
          e.preventDefault()
          const item = s.navItems[cur]
          if (!item) break
          if (item.kind === 'message') {
            const assistantMsgId = s.messages[item.msgIdx + 1]?.id
            const headings = assistantMsgId
              ? (s.headingsByMessage.get(assistantMsgId) ?? [])
              : []
            if (headings.length > 0 && s.expandedTocIdx !== item.msgIdx) {
              handleToggleToc(item.msgIdx, true)
            } else {
              handleClick(item.msgIdx)
              closeCard()
            }
          } else {
            handleHeadingClickInner(item.assistantMsgIdx, item.tocIndex)
          }
          break
        }
        case 'ArrowRight':
        case 'l': {
          e.preventDefault()
          const itemRight = s.navItems[cur]
          if (itemRight?.kind !== 'message') break
          const assistantMsgIdRight = s.messages[itemRight.msgIdx + 1]?.id
          const headingsRight = assistantMsgIdRight
            ? (s.headingsByMessage.get(assistantMsgIdRight) ?? [])
            : []
          if (headingsRight.length > 0 && s.expandedTocIdx !== itemRight.msgIdx)
            handleToggleToc(itemRight.msgIdx, true)
          break
        }
        case 'ArrowLeft':
        case 'h': {
          e.preventDefault()
          const itemLeft = s.navItems[cur]
          if (itemLeft?.kind === 'heading') {
            handleToggleToc(itemLeft.assistantMsgIdx - 1, false)
            const parentNavIdx = s.navItems.findIndex(
              (n) =>
                n.kind === 'message' && n.listIdx === itemLeft.parentListIdx
            )
            if (parentNavIdx !== -1) focusNavItem(parentNavIdx)
          } else if (
            itemLeft?.kind === 'message' &&
            s.expandedTocIdx === itemLeft.msgIdx
          ) {
            handleToggleToc(itemLeft.msgIdx, false)
          }
          break
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    handleClick,
    closeCard,
    handleToggleToc,
    focusNavItem,
    handleHeadingClickInner
  ])

  // Focus current item when card opens via keyboard
  useEffect(() => {
    if (!isKeyboardOpen) return
    requestAnimationFrame(() => {
      const el = itemRefs.current.get(focusedNavIdx)
      if (el) {
        el.focus({ preventScroll: true })
        scrollCardToElement(el)
      }
    })
  }, [isKeyboardOpen, focusedNavIdx, scrollCardToElement])

  // Close when clicking outside
  useEffect(() => {
    if (!isKeyboardOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (
        cardRef.current &&
        !cardRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setIsKeyboardOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isKeyboardOpen])

  // Bookmark helpers
  const assistantHasAnyBookmark = useCallback(
    (assistantMsgId: string | undefined) => {
      if (!assistantMsgId) return false
      return convBookmarks.some((b) => b.message_id === assistantMsgId)
    },
    [convBookmarks]
  )

  const isHeadingBookmarked = useCallback(
    (assistantMsgId: string | undefined, anchor: string) => {
      if (!assistantMsgId) return false
      return convBookmarks.some(
        (b) => b.message_id === assistantMsgId && b.heading_anchor === anchor
      )
    },
    [convBookmarks]
  )

  // Render
  return (
    <>
      {/* Dot rail */}
      <nav
        ref={containerRef}
        aria-label="Thread navigation"
        className={cn(
          'absolute left-2 top-0 bottom-0 flex flex-col justify-center z-20',
          isCardOpen && 'opacity-0 pointer-events-none',
          !hasMessages && 'hidden'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="relative overflow-hidden pr-1 pt-1 pb-1"
          style={{ height: `${containerHeight}px` }}
        >
          <motion.div
            className="flex flex-col gap-1"
            animate={{ y: translateY }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {userMessages.map(({ msg, idx }) => {
              const isActive = idx === effectiveActiveIndex
              const overallIndex = userMessages.findIndex((u) => u.idx === idx)
              const assistantMsgId = messages[idx + 1]?.id
              const hasBookmarks = assistantHasAnyBookmark(assistantMsgId)

              return (
                <button
                  key={msg.id}
                  type="button"
                  className="group relative w-4 h-4 flex items-center justify-center pointer-events-auto"
                  onClick={() => handleClick(idx)}
                  aria-label={`Jump to message ${overallIndex + 1}${hasBookmarks ? ' (has bookmarks)' : ''}`}
                >
                  <div className="w-3 h-[3px] flex items-center justify-start">
                    <motion.div
                      className={cn(
                        'h-[2px] w-3 rounded-full origin-left transition-colors duration-150',
                        isActive
                          ? 'bg-primary'
                          : 'bg-muted-foreground/30 group-hover:bg-primary/60'
                      )}
                      animate={{
                        scaleX: isActive ? 1 : 0.6,
                        scaleY: isActive ? 1.5 : 1,
                        opacity: isActive ? 1 : 0.5
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 35
                      }}
                    />
                  </div>
                  <AnimatePresence mode="wait">
                    {hasBookmarks && (
                      <motion.span
                        key={msg.id}
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
          </motion.div>
        </div>
      </nav>

      {/* Hover / keyboard card */}
      {hasMessages &&
        createPortal(
          <AnimatePresence>
            {isCardOpen && cardPosition && (
              <motion.div
                ref={cardRef}
                initial={{ opacity: 0, x: -5, y: '-50%' }}
                animate={{ opacity: 1, x: 0, y: '-50%' }}
                exit={{ opacity: 0, x: -5, y: '-50%' }}
                transition={{ duration: 0.15 }}
                className="fixed z-50 w-64 p-2 bg-popover rounded-lg border shadow-md flex flex-col"
                style={{
                  top: cardPosition.top,
                  left: cardPosition.left,
                  transform: 'translateY(-50%)',
                  maxHeight: 'min(380px, 70vh)'
                }}
                onMouseEnter={() => {
                  if (stateRef.current.isKeyboardOpen) return
                  if (leaveTimer.current) clearTimeout(leaveTimer.current)
                }}
                onMouseLeave={handleMouseLeave}
              >
                {isKeyboardOpen && (
                  <div className="flex items-center px-1 pb-1.5 mb-1 border-b border-border/50">
                    <span className="text-[10px] text-muted-foreground/50 font-mono leading-none">
                      ↑↓ move · ↵ jump · → expand · Esc close
                    </span>
                  </div>
                )}

                <div
                  ref={scrollContainerRef}
                  className="overflow-y-auto thin-scrollbar flex-1 min-h-0"
                >
                  <div className="space-y-0.5 pr-1">
                    {userMessages.map(({ msg, idx }, listIdx) => {
                      const isActive = idx === effectiveActiveIndex
                      const assistantMsgIdx = idx + 1
                      const assistantMsgId = messages[assistantMsgIdx]?.id
                      const headings = assistantMsgId
                        ? (headingsByMessage.get(assistantMsgId) ?? [])
                        : []
                      const hasHeadings = headings.length > 0
                      const isExpanded = expandedTocIdx === idx
                      const hasAnyBookmark =
                        assistantHasAnyBookmark(assistantMsgId)
                      const msgLevelBookmark = assistantMsgId
                        ? convBookmarks.some(
                            (b) =>
                              b.message_id === assistantMsgId &&
                              !b.heading_anchor
                          )
                        : false

                      const msgNavIdx = navItems.findIndex(
                        (n) => n.kind === 'message' && n.listIdx === listIdx
                      )
                      const isFocused =
                        isCardOpen && focusedNavIdx === msgNavIdx

                      return (
                        <div key={msg.id} data-message-idx={idx}>
                          <div className="flex items-center gap-0.5 w-full">
                            <button
                              ref={(el) => {
                                if (el) {
                                  itemRefs.current.set(msgNavIdx, el)
                                } else {
                                  itemRefs.current.delete(msgNavIdx)
                                }
                              }}
                              type="button"
                              tabIndex={-1}
                              className={cn(
                                'group flex items-center gap-2 flex-1 text-left px-1.5 py-1 rounded transition-colors min-w-0 outline-none',
                                isFocused ? 'bg-muted/60' : 'hover:bg-muted/40'
                              )}
                              onClick={() => {
                                handleClick(idx)
                                closeCard()
                              }}
                              onMouseEnter={() => setFocusedNavIdx(msgNavIdx)}
                              onFocus={() => setFocusedNavIdx(msgNavIdx)}
                            >
                              <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                                <div
                                  className={cn(
                                    'h-[2px] rounded-full transition-all duration-150',
                                    isActive
                                      ? 'w-3 bg-primary'
                                      : 'w-2 bg-muted-foreground/30 group-hover:bg-primary/60'
                                  )}
                                />
                              </div>
                              <p
                                className={cn(
                                  'text-xs truncate flex-1 transition-colors duration-150',
                                  isActive
                                    ? 'text-foreground font-medium'
                                    : 'text-muted-foreground group-hover:text-foreground'
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
                                onClick={() =>
                                  handleToggleToc(idx, !isExpanded)
                                }
                                aria-label={
                                  isExpanded
                                    ? 'Collapse headings'
                                    : 'Expand headings'
                                }
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
                                  {headings.map((h) => {
                                    const hBookmarked = isHeadingBookmarked(
                                      assistantMsgId,
                                      h.id
                                    )
                                    const isH1 = h.level === 1
                                    const isH2 = h.level === 2
                                    const isActiveHeading =
                                      isActive &&
                                      h.toc_index === activeHeadingIndex

                                    // Get the unique nav index for this heading from the map
                                    const headingNavIdx =
                                      headingNavIndexMap.get(
                                        `${assistantMsgId}-${h.id}`
                                      ) ?? -1
                                    const isHFocused =
                                      isCardOpen &&
                                      focusedNavIdx === headingNavIdx

                                    // Explicitly separate color and size logic to prevent inconsistent class merging
                                    const sizeClass = isH1
                                      ? 'text-xs font-medium'
                                      : isH2
                                        ? 'text-xs'
                                        : 'text-[11px]'
                                    const colorClass = isActiveHeading
                                      ? 'text-primary font-medium'
                                      : isH1
                                        ? 'text-muted-foreground'
                                        : isH2
                                          ? 'text-muted-foreground/80'
                                          : 'text-muted-foreground/60'

                                    return (
                                      <button
                                        key={`${assistantMsgId}-${h.id}`}
                                        ref={(el) => {
                                          if (el) {
                                            itemRefs.current.set(
                                              headingNavIdx,
                                              el
                                            )
                                          } else {
                                            itemRefs.current.delete(
                                              headingNavIdx
                                            )
                                          }
                                        }}
                                        type="button"
                                        tabIndex={-1}
                                        data-heading-idx={h.toc_index}
                                        className={cn(
                                          'flex w-full items-center text-left rounded transition-colors group outline-none py-0.5',
                                          isHFocused && 'bg-muted/60'
                                        )}
                                        style={{
                                          paddingLeft: `${(h.level - 1) * 8 + 6}px`
                                        }}
                                        onClick={() =>
                                          handleHeadingClickInner(
                                            assistantMsgIdx,
                                            h.toc_index
                                          )
                                        }
                                        onMouseEnter={() => {
                                          if (headingNavIdx !== -1)
                                            setFocusedNavIdx(headingNavIdx)
                                        }}
                                        onFocus={() => {
                                          if (headingNavIdx !== -1)
                                            setFocusedNavIdx(headingNavIdx)
                                        }}
                                      >
                                        <span
                                          className={cn(
                                            'inline-block flex-shrink-0 self-center rounded-full mr-1.5 transition-colors',
                                            hBookmarked
                                              ? // Larger, opaque amber dot for bookmarked headings
                                                'bg-amber-400 w-1.5 h-1.5'
                                              : // Normal dot sizing and coloring
                                                cn(
                                                  isActiveHeading
                                                    ? 'bg-primary'
                                                    : 'bg-muted-foreground/20 group-hover:bg-primary/40',
                                                  isH1
                                                    ? 'w-1 h-1'
                                                    : 'w-0.5 h-0.5',
                                                  !isH1 && !isH2 && 'opacity-60'
                                                )
                                          )}
                                        />
                                        <span
                                          className={cn(
                                            'truncate flex-1 transition-colors',
                                            !isActiveHeading &&
                                              'group-hover:text-foreground',
                                            sizeClass,
                                            colorClass
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
