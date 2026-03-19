import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { MessageData } from '@/lib/bindings'

interface ThreadNavigatorProps {
  messages: MessageData[]
  onScrollTo: (index: number) => void
  activeIndex?: number
}

export function ThreadNavigator({ messages, onScrollTo, activeIndex }: ThreadNavigatorProps) {
  const [isHovering, setIsHovering] = useState(false)
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const userMessages = messages
    .map((msg, idx) => ({ msg, idx }))
    .filter(({ msg }) => msg.role === 'user')

  if (userMessages.length < 3) return null

  // Update card position when hovering starts or container moves
  useEffect(() => {
    if (!isHovering || !containerRef.current) {
      setCardPosition(null)
      return
    }

    const updatePosition = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      setCardPosition({
        top: rect.top + rect.height / 2,
        left: rect.left - 12, // small gap
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isHovering])

  // Timeout refs for smooth enter/leave
  const enterTimer = useRef<NodeJS.Timeout>()
  const leaveTimer = useRef<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    enterTimer.current = setTimeout(() => {
      setIsHovering(true)
    }, 100) // small open delay to avoid flicker on quick passes
  }

  const handleMouseLeave = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current)
    leaveTimer.current = setTimeout(() => {
      setIsHovering(false)
    }, 300) // longer leave delay to allow moving to card
  }

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (enterTimer.current) clearTimeout(enterTimer.current)
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
    }
  }, [])

  return (
    <>
      {/* Dots container – hover trigger */}
      <div
        ref={containerRef}
        className="absolute right-2 top-0 bottom-0 flex flex-col justify-center gap-1 z-20"
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
              onClick={() => onScrollTo(idx)}
              aria-label={`Jump to message`}
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
      </div>

      {/* Floating card portal – appears on hover */}
      {createPortal(
        <AnimatePresence>
          {isHovering && cardPosition && (
            <motion.div
              initial={{ opacity: 0, x: -5, y: '-50%' }}
              animate={{ opacity: 1, x: 0, y: '-50%' }}
              exit={{ opacity: 0, x: -5, y: '-50%' }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 w-64 p-2 bg-popover rounded-lg border shadow-md overflow-hidden"
              style={{
                top: cardPosition.top,
                left: cardPosition.left,
                transform: 'translateY(-50%)',
                maxHeight: 'min(300px, 70vh)', // prevents page scrollbar
              }}
              onMouseEnter={() => {
                if (leaveTimer.current) clearTimeout(leaveTimer.current)
              }}
              onMouseLeave={handleMouseLeave}
            >
              <div className="max-h-full overflow-y-auto space-y-1 pr-1">
                {userMessages.map(({ msg, idx }) => {
                  const isActive = idx === activeIndex
                  return (
                    <button
                      key={msg.id}
                      className="flex items-start gap-2 w-full text-left hover:bg-muted/50 p-1.5 rounded transition-colors"
                      onClick={() => {
                        onScrollTo(idx)
                        setIsHovering(false) // close card after click
                      }}
                    >
                      {/* Mini dot indicator */}
                      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div
                          className={cn(
                            'h-[3px] w-3 rounded-full',
                            isActive ? 'bg-primary' : 'bg-muted-foreground/50'
                          )}
                        />
                      </div>
                      {/* Message excerpt */}
                      <p className="text-xs text-muted-foreground break-words line-clamp-2 flex-1">
                        {msg.content}
                      </p>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
