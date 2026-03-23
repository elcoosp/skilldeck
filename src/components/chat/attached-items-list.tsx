import type React from 'react'
import { useChatContextStore } from '@/store/chat-context-store'
import { useUIStore } from '@/store/ui'
import { ContextChip } from './context-chip'

export const AttachedItemsList: React.FC = () => {
  const activeConversationId = useUIStore((s) => s.activeConversationId)
  const items = useChatContextStore((s) => s.items[activeConversationId ?? ''] ?? [])
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
