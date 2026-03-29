// src/components/markdown-view.tsx
import { memo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bookmark } from 'lucide-react'
import { NodeDocument, MdNode } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useBookmarksStore } from '@/store/bookmarks'
import { CodeBlock } from '@/components/conversation/code-block'

// ─── Internal HeadingBookmarkButton ─────────────────────────────────────────
const HeadingBookmarkButton = memo(function HeadingBookmarkButton({
  messageId,
  headingAnchor,
  headingLabel,
  conversationId,
}: {
  messageId: string
  headingAnchor: string
  headingLabel: string
  conversationId: string | null
}) {
  const isBookmarked = useBookmarksStore(
    useCallback(
      (s) => {
        if (!conversationId) return false
        const convBookmarks = s.bookmarks[conversationId]
        if (!convBookmarks || !Array.isArray(convBookmarks)) return false
        return convBookmarks.some(
          (b) => b.message_id === messageId && b.heading_anchor === headingAnchor
        )
      },
      [conversationId, messageId, headingAnchor]
    )
  )

  const toggle = useCallback(() => {
    if (!conversationId) return
    useBookmarksStore.getState().toggleBookmark(conversationId, messageId, headingAnchor, headingLabel)
  }, [conversationId, messageId, headingAnchor, headingLabel])

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
      }}
      className={cn(
        'ml-1 inline-flex items-center justify-center p-0.5 rounded hover:bg-muted-foreground/10 transition-opacity',
        isBookmarked ? 'opacity-100' : 'opacity-0 group-hover/heading:opacity-100'
      )}
      aria-label={isBookmarked ? 'Remove heading bookmark' : 'Bookmark this heading'}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.1 }}
    >
      <Bookmark
        className={cn(
          'size-3 transition-colors duration-150',
          isBookmarked ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'
        )}
      />
    </motion.button>
  )
})

interface MarkdownViewProps {
  document: NodeDocument | null
  messageId: string
  className?: string
  conversationId?: string | null
}

export const MarkdownView = memo(({ document, messageId, className, conversationId }: MarkdownViewProps) => {
  if (!document) {
    return null
  }

  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none break-words', className)}>
      {document.stable_nodes.map(node => (
        <NodeRenderer
          key={node.id}
          node={node}
          messageId={messageId}
          conversationId={conversationId ?? null}
        />
      ))}
      {document.draft_nodes.length > 0 && (
        <>
          {document.draft_nodes.map(node => (
            <NodeRenderer
              key={node.id}
              node={node}
              messageId={messageId}
              conversationId={conversationId ?? null}
            />
          ))}
          <span className="inline-block w-0.5 h-4 bg-current animate-pulse align-text-bottom ml-0.5" />
        </>
      )}
    </div>
  )
})

interface NodeRendererProps {
  node: MdNode
  messageId: string
  conversationId: string | null
}

function NodeRenderer({ node, messageId, conversationId }: NodeRendererProps) {
  switch (node.type) {
    case 'paragraph':
      return <p dangerouslySetInnerHTML={{ __html: node.html }} />
    case 'heading': {
      const level = node.level as 1 | 2 | 3 | 4 | 5 | 6
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements
      return (
        <div className="group/heading relative inline-block w-full">
          <HeadingTag id={node.slug} className="scroll-mt-12 inline">
            {node.text}
          </HeadingTag>
          <HeadingBookmarkButton
            messageId={messageId}
            headingAnchor={node.slug}
            headingLabel={node.text}
            conversationId={conversationId}
          />
        </div>
      )
    }
    case 'code_block':
      return (
        <CodeBlock
          language={node.language}
          artifactId={node.artifact_id}
          highlightedHtml={node.highlighted_html}
        />
      )
    case 'list': {
      const ListTag = node.ordered ? 'ol' : 'ul'
      return <ListTag className="pl-5" dangerouslySetInnerHTML={{ __html: node.html }} />
    }
    case 'blockquote':
      return <blockquote className="pl-4 border-l-4 border-muted" dangerouslySetInnerHTML={{ __html: node.html }} />
    case 'horizontal_rule':
      return <hr />
    case 'html_block':
      return <div dangerouslySetInnerHTML={{ __html: node.html }} />
    default:
      return null
  }
}
