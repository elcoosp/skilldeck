// src/components/conversation/queue/queue-item.tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, CheckSquare, Square } from 'lucide-react'
import { useQueueStore } from '@/store/queue'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { QueuedMessage } from '@/hooks/use-queued-messages'
import { QueueEditForm } from './queue-edit-form'
import { useDeleteQueuedMessage } from '@/hooks/use-queued-messages'

interface QueueItemProps {
  message: QueuedMessage
  conversationId: string
  position: number
  total: number
}

export function QueueItem({ message, conversationId, position, total }: QueueItemProps) {
  const {
    mode,
    selectedIds,
    editingId,
    toggleSelected,
    setEditingId,
    setIsDragging,
  } = useQueueStore((s) => ({
    mode: s.mode[conversationId] ?? 'view',
    selectedIds: s.selectedIds[conversationId] ?? new Set(),
    editingId: s.editingId[conversationId],
    toggleSelected: s.toggleSelected,
    setEditingId: s.setEditingId,
    setIsDragging: s.setIsDragging,
  }))

  const deleteMutation = useDeleteQueuedMessage(conversationId)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isDraggingItem,
  } = useSortable({ id: message.id })

  // Update global dragging state
  if (isDraggingItem) {
    setIsDragging(conversationId, true)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isSelected = selectedIds.has(message.id)
  const isEditing = editingId === message.id

  const handleDelete = () => {
    deleteMutation.mutate(message.id)
  }

  if (isEditing) {
    return (
      <div className="border-b border-border last:border-0">
        <QueueEditForm
          conversationId={conversationId}
          messageId={message.id}
          initialContent={message.content}
          onCancel={() => setEditingId(conversationId, null)}
        />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 px-3 py-2 border-b border-border last:border-0',
        'hover:bg-muted/30 transition-colors',
        isSelected && 'bg-primary/5'
      )}
    >
      {/* Drag handle – only visible in view mode */}
      {mode === 'view' && (
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}

      {/* Selection checkbox – only visible in select mode */}
      {mode === 'select' && (
        <button
          type="button"
          onClick={() => toggleSelected(conversationId, message.id)}
          className="text-muted-foreground hover:text-foreground"
        >
          {isSelected ? (
            <CheckSquare className="size-4 text-primary" />
          ) : (
            <Square className="size-4" />
          )}
        </button>
      )}

      {/* Position badge – shows position/total in view mode */}
      {mode === 'view' && (
        <span className="w-10 text-center text-[10px] font-medium text-muted-foreground bg-muted rounded-full py-0.5">
          {position}/{total}
        </span>
      )}

      {/* Message preview */}
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate">{message.content}</p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(message.created_at).toLocaleTimeString()}
        </p>
      </div>

      {/* Action buttons – only in view mode */}
      {mode === 'view' && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setEditingId(conversationId, message.id)}
          >
            <Pencil className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
