// src/components/markdown-view.tsx
import { memo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bookmark } from 'lucide-react'
import { toast } from 'sonner'
import { openUrl } from '@tauri-apps/plugin-opener'
import { NodeDocument, MdNode } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useBookmarks, useToggleBookmark } from '@/hooks/use-bookmarks'
import { CodeBlock } from '@/components/conversation/code-block'

// ─── Internal HeadingBookmarkButton ─────────────────────────────────────────
const HeadingBookmarkButton = memo(({
  messageId,
  headingAnchor,
  headingLabel,
  conversationId,
}: {
  messageId: string
  headingAnchor: string
  headingLabel: string
  conversationId: string | null
}) => {
  const { data: bookmarks = [] } = useBookmarks(conversationId)
  const toggleBookmark = useToggleBookmark(conversationId)

  const isBookmarked = bookmarks.some(
    (b) => b.message_id === messageId && b.heading_anchor === headingAnchor,
  )

  const handleToggle = useCallback(() => {
    if (!conversationId) return
    toggleBookmark.mutate({ messageId, headingAnchor, label: headingLabel })
  }, [conversationId, messageId, headingAnchor, headingLabel, toggleBookmark])

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleToggle()
      }}
      className={cn(
        'ml-1 inline-flex items-center justify-center p-0.5 rounded hover:bg-muted-foreground/10 transition-opacity',
        isBookmarked ? 'opacity-100' : 'opacity-0 group-hover/heading:opacity-100',
      )}
      aria-label={isBookmarked ? 'Remove heading bookmark' : 'Bookmark this heading'}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.1 }}
    >
      <Bookmark
        className={cn(
          'size-3 transition-colors duration-150',
          isBookmarked ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground',
        )}
      />
    </motion.button>
  )
})

// ─── Split props: stable nodes never receive isStreaming ─────────────────────
interface StableNodeListProps {
  nodes: MdNode[]
  messageId: string
  conversationId: string | null
  scrollContainerRef?: React.RefObject<HTMLElement>
}

interface DraftNodeListProps extends StableNodeListProps {
  isStreaming?: boolean
}

// ─── Optimized Node List Components ─────────────────────────────────────────
const StableNodeList = memo(({
  nodes, messageId, conversationId, scrollContainerRef
}: StableNodeListProps) => (
  <>
    {nodes.map((node) => (
      <NodeRenderer
        key={node.id}
        node={node}
        messageId={messageId}
        conversationId={conversationId}
        scrollContainerRef={scrollContainerRef}
      />
    ))}
  </>
), (prev, next) =>
  prev.nodes === next.nodes &&
  prev.messageId === next.messageId &&
  prev.conversationId === next.conversationId &&
  prev.scrollContainerRef === next.scrollContainerRef
)

const DraftNodeList = memo(({ nodes, messageId, conversationId, isStreaming, scrollContainerRef }: DraftNodeListProps) => {
  if (nodes.length === 0) return null
  return (
    <>
      {nodes.map((node) => (
        <NodeRenderer
          key={node.id}
          node={node}
          messageId={messageId}
          conversationId={conversationId}
          isStreaming={isStreaming}
          scrollContainerRef={scrollContainerRef}
        />
      ))}
    </>
  )
})

interface MarkdownViewProps {
  document: NodeDocument | null
  messageId: string
  className?: string
  conversationId?: string | null
  isStreaming?: boolean
  scrollContainerRef?: React.RefObject<HTMLElement>
}

export const MarkdownView = memo(({
  document,
  messageId,
  className,
  conversationId,
  isStreaming = false,
  scrollContainerRef,
}: MarkdownViewProps) => {
  const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest('a[data-external-link]')
    if (link) {
      e.preventDefault()
      const href = (link as HTMLAnchorElement).href
      if (href) openUrl(href)
      return
    }

    const code = (e.target as HTMLElement).closest('code[data-inline-code]')
    if (code) {
      const text = code.textContent ?? ''
      if (text) {
        await navigator.clipboard.writeText(text)
        toast.success('Code copied to clipboard')
      }
      return
    }
  }, [])

  if (!document) {
    return null
  }

  const convId = conversationId ?? null

  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none break-words', className)}
      onClick={handleClick}
    >
      <StableNodeList
        nodes={document.stable_nodes}
        messageId={messageId}
        conversationId={convId}
        scrollContainerRef={scrollContainerRef}
      />
      <DraftNodeList
        nodes={document.draft_nodes}
        messageId={messageId}
        conversationId={convId}
        isStreaming={isStreaming}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  )
}, (prev, next) => {
  // Exact same reference — skip re-render
  if (prev.document === next.document) return true
  // Streaming flag changed — must re-render
  if (prev.isStreaming !== next.isStreaming) return false
  // Settled message with new document reference — must re-render
  if (!next.isStreaming) return false
  // During streaming: only re-render if draft_nodes changed
  // stable_nodes are protected by StableNodeList's own comparator
  return prev.document?.draft_nodes === next.document?.draft_nodes
})

interface NodeRendererProps {
  node: MdNode
  messageId: string
  conversationId: string | null
  isStreaming?: boolean
  scrollContainerRef?: React.RefObject<HTMLElement>
}

const NodeRenderer = memo(({ node, messageId, conversationId, isStreaming, scrollContainerRef }: NodeRendererProps) => {
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
          isStreaming={isStreaming}
          scrollContainerRef={scrollContainerRef}
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
}, (prev, next) =>
  prev.node === next.node &&
  prev.messageId === next.messageId &&
  prev.conversationId === next.conversationId &&
  prev.isStreaming === next.isStreaming &&
  prev.scrollContainerRef === next.scrollContainerRef
)
