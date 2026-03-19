import * as HoverCard from '@radix-ui/react-hover-card'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { MessageData } from '@/lib/bindings'

interface ThreadNavigatorProps {
  messages: MessageData[]
  onScrollTo: (index: number) => void
  activeIndex?: number
}

export function ThreadNavigator({ messages, onScrollTo, activeIndex }: ThreadNavigatorProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const userMessages = messages
    .map((msg, idx) => ({ msg, idx }))
    .filter(({ msg }) => msg.role === 'user')

  if (userMessages.length < 3) return null

  const hoveredMessage = userMessages.find(({ idx }) => idx === hoveredIndex)?.msg

  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-center gap-1 z-20 pointer-events-none">
          {userMessages.map(({ msg, idx }) => {
            const isActive = idx === activeIndex

            return (
              <button
                key={msg.id}
                type="button"
                className="group w-4 h-4 flex items-center justify-center pointer-events-auto"
                onClick={() => onScrollTo(idx)}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
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
      </HoverCard.Trigger>

      <HoverCard.Portal>
        <HoverCard.Content
          side="left"
          align="center"
          className="z-50 w-64 max-h-48 overflow-y-auto p-3 text-xs bg-popover rounded-lg border shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        >
          {hoveredMessage ? (
            <p className="whitespace-pre-wrap break-words leading-relaxed text-muted-foreground hover:text-primary transition-colors">
              {hoveredMessage.content}
            </p>
          ) : (
            <p className="text-muted-foreground">Hover over a dot to preview</p>
          )}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
