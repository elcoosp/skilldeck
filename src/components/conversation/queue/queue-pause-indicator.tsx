// src/components/conversation/queue/queue-pause-indicator.tsx
import { AnimatePresence, motion } from 'framer-motion'
import { Pause } from 'lucide-react'
import { useQueueStore } from '@/store/queue'

interface QueuePauseIndicatorProps {
  conversationId: string
}

export function QueuePauseIndicator({
  conversationId
}: QueuePauseIndicatorProps) {
  const editingId = useQueueStore((s) => s.editingId[conversationId])
  const isDragging = useQueueStore((s) => s.isDragging[conversationId] ?? false)
  const mode = useQueueStore((s) => s.mode[conversationId] ?? 'view')

  const isPaused = editingId !== null || isDragging || mode === 'select'

  return (
    <AnimatePresence>
      {isPaused && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-x-0 top-0 h-7 bg-warning text-warning-foreground text-xs flex items-center justify-center gap-1.5 z-10"
        >
          <Pause className="size-3.5" />
          <span>Auto‑send paused – finish editing to continue</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
