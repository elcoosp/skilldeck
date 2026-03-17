// src/components/conversation/queue/queue-list.tsx
import { useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useQueuedMessages,
  useReorderQueuedMessages,
} from '@/hooks/use-queued-messages'
import { useQueueStore } from '@/store/queue'
import { commands } from '@/lib/bindings'
import { QueuePauseIndicator } from './queue-pause-indicator'
import { QueueSelectionToolbar } from './queue-selection-toolbar'
import { QueueItem } from './queue-item'

interface QueueListProps {
  conversationId: string
}

export function QueueList({ conversationId }: QueueListProps) {
  const { data: messages = [], isLoading } = useQueuedMessages(conversationId)
  const reorderMutation = useReorderQueuedMessages(conversationId)

  const mode = useQueueStore((s) => s.mode[conversationId] ?? 'view')
  const setIsDragging = useQueueStore((s) => s.setIsDragging)

  // Get pause-related state
  const editingId = useQueueStore((s) => s.editingId[conversationId])
  const isDragging = useQueueStore((s) => s.isDragging[conversationId] ?? false)

  const isPaused = editingId !== null || isDragging || mode === 'select'

  // Sync pause state to backend and trigger processing when unpaused
  useEffect(() => {
    commands.setAutoSendPaused(conversationId, isPaused)
      .catch(err => console.error('Failed to set auto-send pause:', err))

    // When unpaused, trigger processing of queued messages
    if (!isPaused) {
      commands.processQueuedMessages(conversationId)
        .catch(err => console.error('Failed to process queued messages:', err))
    }
  }, [conversationId, isPaused])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
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
    return <div className="p-3 text-xs text-muted-foreground">Loading queue...</div>
  }

  if (messages.length === 0) {
    return null
  }

  return (
    <div className="relative flex flex-col max-h-[200px] overflow-hidden border-t border-border">
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
    </div>
  )
}
