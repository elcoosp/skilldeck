import React from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useBookmarksStore } from '@/store/bookmarks';
import { useConversationStore } from '@/store/conversation';
import { cn } from '@/lib/utils';

interface HeadingProps {
  slotId: string; // not used, kept for consistency
  level: number;
  slug: string;
  text: string;
  messageId?: string;
}

export const Heading: React.FC<HeadingProps> = ({ level, slug, text, messageId }) => {
  const conversationId = useConversationStore(s => s.activeConversationId);
  const isBookmarked = useBookmarksStore(s =>
    conversationId
      ? (s.bookmarks[conversationId] ?? []).some(b => b.heading_anchor === slug)
      : false,
  );

  const toggle = () => {
    if (!conversationId) return;
    // Use the passed messageId if available, otherwise fallback to ''
    const msgId = messageId ?? '';
    useBookmarksStore.getState().toggleBookmark(conversationId, msgId, slug, text);
  };

  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
  return (
    <Tag id={slug} className="group/heading flex items-center">
      {text}
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'ml-1.5 p-0.5 rounded transition-opacity',
          isBookmarked ? 'opacity-100' : 'opacity-0 group-hover/heading:opacity-100',
        )}
      >
        {isBookmarked
          ? <BookmarkCheck className="size-3 text-amber-400 fill-amber-400" />
          : <Bookmark className="size-3 text-muted-foreground" />}
      </button>
    </Tag>
  );
};
