import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { MessageData } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface VirtualItem {
  index: number
  start: number
  size: number
}

interface VirtualizerRef {
  scrollToIndex: (index: number, options?: { behavior?: 'auto' | 'smooth'; align?: 'start' | 'end' | 'center' | 'auto' }) => void
  getVirtualItems: () => VirtualItem[]
}

interface ThreadNavigatorProps {
  messages: MessageData[]
  /**
   * Direct ref to the scroll container — the navigator subscribes to its
   * scroll events itself, eliminating the onVisibleUserIndexChange callback
   * chain and the parent re-renders it caused.
   */
  scrollRef: React.RefObject<HTMLDivElement>
  /**
   * Direct ref to the virtualizer — the navigator calls scrollToIndex itself
   * on click, no intermediary needed.
   */
  virtualizerRef: React.RefObject<VirtualizerRef>
  /**
   * Called when a dot is clicked, so the parent can flash the highlight ring.
   * Receives the full-array message index.
   */
  onScrollTo: (index: number) => void
}

/**
 * Derives the index (in the full messages array) of the user message whose
 * position is closest to the top of the viewport.
 */
function deriveActiveIndex(
  scrollEl: HTMLDivElement,
  virtualizer: VirtualizerRef,
  userIndices: number[]
): number {
  if (userIndices.length === 0) return -1
  const { scrollTop, scrollHeight, clientHeight } = scrollEl
  const maxScroll = scrollHeight - clientHeight

  if (scrollTop <= 0) return userIndices[0]
  if (maxScroll <= 0 || scrollTop >= maxScroll - 1) return userIndices[userIndices.length - 1]

  const items = virtualizer.getVirtualItems()
  if (items.length === 0) return userIndices[0]

  // Topmost item: first item whose bottom edge is below the current scrollTop.
  const topItem = items.find(item => item.start + item.size > scrollTop) ?? items[0]
  const topIndex = topItem.index

  return userIndices.reduce((best, ui) =>
    Math.abs(ui - topIndex) < Math.abs(best - topIndex) ? ui : best
  )
}

export function ThreadNavigator({
  messages,
  scrollRef,
  virtualizerRef,
  onScrollTo,
}: ThreadNavigatorProps) {
  // Stable list of user-message indices — only changes when messages change,
  // not on every streaming token (since assistant messages stream, not user ones).
  const userMessages = useMemo(
    () => messages
      .map((msg, idx) => ({ msg, idx }))
      .filter(({ msg }) => msg.role === 'user'),
    [messages]
  )

  const userIndices = useMemo(
    () => userMessages.map(({ idx }) => idx),
    [userMessages]
  )

  // ── Active index via useSyncExternalStore ──────────────────────────────
  // We subscribe directly to the scroll element so only this component
  // re-renders when the active dot needs to change — no parent setState,
  // no CenterPanel re-render.
  const activeIndex = useSyncExternalStore(
    // subscribe
    (callback) => {
      const el = scrollRef.current
      if (!el) return () => { }
      el.addEventListener('scroll', callback, { passive: true })
      return () => el.removeEventListener('scroll', callback)
    },
    // getSnapshot — called synchronously by React to read the current value
    () => {
      const el = scrollRef.current
      const virt = virtualizerRef.current
      if (!el || !virt || userIndices.length === 0) return -1
      return deriveActiveIndex(el, virt, userIndices)
    },
    // getServerSnapshot
    () => -1
  )

  // ── Hover state for the popup card ────────────────────────────────────
  const [isHovering, setIsHovering] = useState(false)
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isHovering || !containerRef.current) {
      setCardPosition(null)
      return
    }
    const updatePosition = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const cardWidth = 256
      const rightMargin = 16
      let left = rect.left
      const maxLeft = window.innerWidth - cardWidth - rightMargin
      if (left > maxLeft) left = maxLeft
      setCardPosition({ top: rect.top + rect.height / 2, left })
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isHovering])

  useEffect(() => () => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
  }, [])

  if (userMessages.length < 3) return null

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    enterTimer.current = setTimeout(() => setIsHovering(true), 100)
  }
  const handleMouseLeave = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => setIsHovering(false), 300)
  }

  const handleClick = (idx: number) => {
    // Scroll the virtualizer directly — no round-trip through parent state.
    virtualizerRef.current?.scrollToIndex(idx, { behavior: 'smooth', align: 'start' })
    // Notify parent only to trigger the highlight ring flash.
    onScrollTo(idx)
  }

  return (
    <>
      <nav
        ref={containerRef}
        aria-label="Thread navigation"
        className={cn(
          'absolute left-2 top-0 bottom-0 flex flex-col justify-center gap-1 z-20',
          isHovering && 'opacity-0 pointer-events-none'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {userMessages.map(({ msg, idx }) => {
          const isActive = idx === activeIndex
          return (
            <button
              key={msg.id}
              type="button"
              className="group w-4 h-4 flex items-center justify-center pointer-events-auto"
              onClick={() => handleClick(idx)}
              aria-label="Jump to message"
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
                    opacity: isActive ? 1 : 0.5,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              </div>
            </button>
          )
        })}
      </nav>

      {createPortal(
        <AnimatePresence>
          {isHovering && cardPosition && (
            <motion.div
              initial={{ opacity: 0, x: -5, y: '-50%' }}
              animate={{ opacity: 1, x: 0, y: '-50%' }}
              exit={{ opacity: 0, x: -5, y: '-50%' }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 w-64 p-2 bg-popover rounded-lg border shadow-md"
              style={{
                top: cardPosition.top,
                left: cardPosition.left,
                transform: 'translateY(-50%)',
                maxHeight: 'min(380px, 70vh)',
              }}
              onMouseEnter={() => {
                if (leaveTimer.current) clearTimeout(leaveTimer.current)
              }}
              onMouseLeave={handleMouseLeave}
            >
              <ScrollArea className="h-full max-h-[inherit] pr-2">
                <div className="space-y-1">
                  {userMessages.map(({ msg, idx }) => {
                    const isActive = idx === activeIndex
                    return (
                      <button
                        key={msg.id}
                        type="button"
                        className="flex items-start gap-2 w-full text-left hover:bg-muted/50 p-1.5 rounded transition-colors"
                        onClick={() => {
                          handleClick(idx)
                          setIsHovering(false)
                        }}
                      >
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <div className={cn(
                            'h-[3px] w-3 rounded-full',
                            isActive ? 'bg-primary' : 'bg-muted-foreground/50'
                          )} />
                        </div>
                        <p className="text-xs text-muted-foreground break-words line-clamp-2 flex-1">
                          {msg.content}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
