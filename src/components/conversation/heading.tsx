import { Bookmark, BookmarkCheck } from 'lucide-react'
import type React from 'react'
import { useBookmarks, useToggleBookmark } from '@/hooks/use-bookmarks'
import { cn } from '@/lib/utils'
import { useConversationStore } from '@/store/conversation'

interface HeadingProps {
  slotId: string // not used, kept for consistency
  level: number
  slug: string
  text: string
  messageId?: string
}

export const Heading: React.FC<HeadingProps> = ({
  level,
  slug,
  text,
  messageId
}) => {
  const conversationId = useConversationStore((s) => s.activeConversationId)
  const { data: bookmarks = [] } = useBookmarks(conversationId)
  const toggleBookmark = useToggleBookmark(conversationId)

  const isBookmarked = bookmarks.some((b) => b.heading_anchor === slug)

  const toggle = () => {
    if (!conversationId) return
    // Use the passed messageId if available, otherwise fallback to ''
    const msgId = messageId ?? ''
    toggleBookmark.mutate({
      messageId: msgId,
      headingAnchor: slug,
      label: text
    })
  }

  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements
  return (
    <Tag id={slug} className="group/heading flex items-center">
      {text}
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'ml-1.5 p-0.5 rounded transition-opacity',
          isBookmarked
            ? 'opacity-100'
            : 'opacity-0 group-hover/heading:opacity-100'
        )}
      >
        {isBookmarked ? (
          <BookmarkCheck className="size-3 text-amber-400 fill-amber-400" />
        ) : (
          <Bookmark className="size-3 text-muted-foreground" />
        )}
      </button>
    </Tag>
  )
}
