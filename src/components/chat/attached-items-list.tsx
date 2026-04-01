import type React from 'react'
import { useChatContextStore } from '@/store/chat-context-store'
import { useConversationStore } from '@/store/conversation'
import type { AttachedItem } from '@/types/chat-context'
import { ContextChip } from './context-chip'

// Stable empty array reference to avoid creating new arrays on every selector call
const EMPTY_ARRAY: AttachedItem[] = []

export const AttachedItemsList: React.FC = () => {
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId
  )
  const items = useChatContextStore(
    (s) => s.items[activeConversationId ?? ''] ?? EMPTY_ARRAY
  )
  const removeItem = useChatContextStore((s) => s.removeItem)

  if (!activeConversationId || items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 px-1 pb-1.5 mt-2">
      {items.map((item) => (
        <ContextChip
          key={item.data.id}
          item={item}
          onRemove={() => removeItem(activeConversationId, item.data.id)}
        />
      ))}
    </div>
  )
}
