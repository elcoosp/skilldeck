// src/components/conversation/queue/queue-list.tsx

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import {
  useQueuedMessages,
  useReorderQueuedMessages
} from '@/hooks/use-queued-messages'
import { commands } from '@/lib/bindings'
import { useQueueStore } from '@/store/queue'
import { QueueItem } from './queue-item'
import { QueuePauseIndicator } from './queue-pause-indicator'
import { QueueSelectionToolbar } from './queue-selection-toolbar'

interface QueueListProps {
  conversationId: string
}

export function QueueList({ conversationId }: QueueListProps) {
  const { data: messages = [], isLoading } = useQueuedMessages(conversationId)
  const reorderMutation = useReorderQueuedMessages(conversationId)

  const mode = useQueueStore((s) => s.mode[conversationId] ?? 'view')
  const setIsDragging = useQueueStore((s) => s.setIsDragging)

  const editingId = useQueueStore((s) => s.editingId[conversationId])
  const isDragging = useQueueStore((s) => s.isDragging[conversationId] ?? false)

  const isPaused = editingId !== null || isDragging || mode === 'select'

  useEffect(() => {
    commands
      .setAutoSendPaused(conversationId, isPaused)
      .catch((err) => console.error('Failed to set auto-send pause:', err))

    if (!isPaused) {
      commands
        .processQueuedMessages(conversationId)
        .catch((err) =>
          console.error('Failed to process queued messages:', err)
        )
    }
  }, [conversationId, isPaused])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setIsDragging(conversationId, false)

    if (!over || active.id === over.id) return

    const oldIndex = messages.findIndex((m) => m.id === active.id)
    const newIndex = messages.findIndex((m) => m.id === over.id)

    const newOrder = [...messages]
    const [moved] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, moved)

    reorderMutation.mutate(newOrder.map((m) => m.id))
  }

  const handleDragStart = () => {
    setIsDragging(conversationId, true)
  }

  if (isLoading) {
    return (
      <div className="p-3 text-xs text-muted-foreground">Loading queue...</div>
    )
  }

  // Animate presence wrapper
  return (
    <AnimatePresence mode="wait">
      {messages.length > 0 && (
        <motion.div
          key="queue-container"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="relative flex flex-col overflow-hidden border-t border-border"
          style={{ maxHeight: 200 }}
        >
          <QueuePauseIndicator conversationId={conversationId} />

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              onDragStart={handleDragStart}
            >
              <SortableContext
                items={messages.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="divide-y divide-border">
                  {messages.map((message, index) => (
                    <QueueItem
                      key={message.id}
                      message={message}
                      conversationId={conversationId}
                      position={index + 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {mode === 'select' && (
            <QueueSelectionToolbar
              conversationId={conversationId}
              messageIds={messages.map((m) => m.id)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
