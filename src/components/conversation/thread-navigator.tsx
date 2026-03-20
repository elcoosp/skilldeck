import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  scrollRef: React.RefObject<HTMLDivElement>
  virtualizerRef: React.RefObject<VirtualizerRef>
  onScrollTo: (index: number) => void
}

export function ThreadNavigator({
  messages,
  scrollRef,
  virtualizerRef,
  onScrollTo,
}: ThreadNavigatorProps) {
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

  const userIndicesRef = useRef(userIndices)
  userIndicesRef.current = userIndices

  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      const indices = userIndicesRef.current
      if (indices.length === 0) { setActiveIndex(-1); return }

      const { scrollTop, scrollHeight, clientHeight } = el
      const maxScroll = scrollHeight - clientHeight

      if (scrollTop <= 0) { setActiveIndex(indices[0]); return }
      if (maxScroll <= 0 || scrollTop >= maxScroll - 1) { setActiveIndex(indices[indices.length - 1]); return }

      const virt = virtualizerRef.current as any
      const cache: Array<{ index: number; start: number; size: number }> = virt?.measurementsCache ?? []

      let result = indices[0]
      for (const ui of indices) {
        // Prefer live DOM position (accurate for rendered items)
        const domItem = scrollRef.current?.querySelector(`[data-message-index="${ui}"]`) as HTMLElement | null
        let top: number | null = null

        if (domItem) {
          const match = domItem.style.transform.match(/translateY\(([-\d.]+)px\)/)
          if (match) top = parseFloat(match[1])
        }

        // Fall back to measurements cache for items outside the render window
        if (top === null && cache[ui]) {
          top = cache[ui].start
        }

        if (top === null) continue
        if (top <= scrollTop + 1) result = ui
        else break
      }
      setActiveIndex(result)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef])

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
    const virt = virtualizerRef.current
    if (!virt) return
    virt.scrollToIndex(idx, { behavior: 'auto', align: 'start' })
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
          const dotNumber = userIndices.indexOf(idx)
          return (
            <button
              key={msg.id}
              type="button"
              className="group w-4 h-4 flex items-center justify-center pointer-events-auto"
              onClick={() => handleClick(idx)}
              aria-label={`Jump to message ${dotNumber + 1}`}
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
                height: 'min(380px, 70vh)', // fixed height, not maxHeight
              }}
              onMouseEnter={() => {
                if (leaveTimer.current) clearTimeout(leaveTimer.current)
              }}
              onMouseLeave={handleMouseLeave}
            >
              <ScrollArea
                className="h-full"
                style={{ height: 'calc(min(380px, 70vh) - 16px)' }} // subtract padding (p-2 = 8px top + 8px bottom)
              >
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
