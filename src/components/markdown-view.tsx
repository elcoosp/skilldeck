// src/components/markdown-view.tsx

import { openUrl } from '@tauri-apps/plugin-opener'
import { motion } from 'framer-motion'
import { Bookmark } from 'lucide-react'
import type { JSX } from 'react'
import { memo, useCallback } from 'react'
import { toast } from '@/components/ui/toast'
import { CodeBlock } from '@/components/conversation/code-block'
import { useBookmarks, useToggleBookmark } from '@/hooks/use-bookmarks'
import type { MdNode, NodeDocument } from '@/lib/bindings'
import { cn } from '@/lib/utils'

// ─── Internal HeadingBookmarkButton ─────────────────────────────────────────
const HeadingBookmarkButton = memo(
  ({
    messageId,
    headingAnchor,
    headingLabel,
    conversationId
  }: {
    messageId: string
    headingAnchor: string
    headingLabel: string
    conversationId: string | null
  }) => {
    const { data: bookmarks = [] } = useBookmarks(conversationId)
    const toggleBookmark = useToggleBookmark(conversationId)

    const isBookmarked = bookmarks.some(
      (b) => b.message_id === messageId && b.heading_anchor === headingAnchor
    )

    // Fix 2: guard against synthetic message IDs that don't exist in the DB
    const isDisabled =
      !conversationId ||
      messageId === '__streaming__' ||
      messageId.startsWith('__')

    // --- DEBUG LOGS ---
    console.log('[HeadingBookmarkButton] Render', {
      messageId,
      headingAnchor,
      headingLabel,
      conversationId,
      isDisabled,
      isBookmarked,
      bookmarksCount: bookmarks.length
    })

    const handleToggle = useCallback(() => {
      if (isDisabled) {
        return
      }
      toggleBookmark.mutate({ messageId, headingAnchor, label: headingLabel })
    }, [isDisabled, messageId, headingAnchor, headingLabel, toggleBookmark])

    return (
      <motion.button
        type="button"
        disabled={isDisabled}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleToggle()
        }}
        className={cn(
          'ml-1 inline-flex items-center justify-center p-0.5 rounded hover:bg-muted-foreground/10 transition-opacity',
          isBookmarked
            ? 'opacity-100'
            : 'opacity-0 group-hover/heading:opacity-100',
          isDisabled && 'cursor-not-allowed opacity-0 pointer-events-none'
        )}
        aria-label={
          isBookmarked ? 'Remove heading bookmark' : 'Bookmark this heading'
        }
        whileTap={{ scale: isDisabled ? 1 : 0.9 }}
        transition={{ duration: 0.1 }}
      >
        <Bookmark
          className={cn(
            'size-3 transition-colors duration-150',
            isBookmarked
              ? 'text-amber-400 fill-amber-400'
              : 'text-muted-foreground'
          )}
        />
      </motion.button>
    )
  }
)
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
const StableNodeList = memo(
  ({
    nodes,
    messageId,
    conversationId,
    scrollContainerRef
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
  ),
  (prev, next) =>
    prev.nodes === next.nodes &&
    prev.messageId === next.messageId &&
    prev.conversationId === next.conversationId &&
    prev.scrollContainerRef === next.scrollContainerRef
)

const DraftNodeList = memo(
  ({
    nodes,
    messageId,
    conversationId,
    isStreaming,
    scrollContainerRef
  }: DraftNodeListProps) => {
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
            isDraft
            scrollContainerRef={scrollContainerRef}
          />
        ))}
      </>
    )
  }
)

interface MarkdownViewProps {
  document: NodeDocument | null
  messageId: string
  className?: string
  conversationId?: string | null
  isStreaming?: boolean
  scrollContainerRef?: React.RefObject<HTMLElement>
}

function draftNodesEqual(a: MdNode[], b: MdNode[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false
    const an = a[i] as Record<string, unknown>
    const bn = b[i] as Record<string, unknown>
    if (an.html !== bn.html) return false
    if (an.highlighted_html !== bn.highlighted_html) return false
    if (an.text !== bn.text) return false
  }
  return true
}

export const MarkdownView = memo(
  ({
    document,
    messageId,
    className,
    conversationId,
    isStreaming = false,
    scrollContainerRef
  }: MarkdownViewProps) => {
    const handleClick = useCallback(
      async (e: React.MouseEvent<HTMLDivElement>) => {
        const anchor = (e.target as HTMLElement).closest('a')
        if (anchor) {
          e.preventDefault()
          const href = anchor.getAttribute('href')
          if (!href) return

          // Internal hash link → scroll into view
          if (href.startsWith('#')) {
            const targetId = href.slice(1)
            if (targetId) {
              const targetElement = window.document.getElementById(targetId)
              if (targetElement) {
                targetElement.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start'
                })
              }
            }
            return
          }

          // All other links: open with the system's default handler
          await openUrl(href)
          return
        }

        // Inline code copy (unchanged)
        const code = (e.target as HTMLElement).closest('code[data-inline-code]')
        if (code) {
          const text = code.textContent ?? ''
          if (text) {
            await navigator.clipboard.writeText(text)
            toast.success('Code copied to clipboard')
          }
          return
        }
      },
      []
    )

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick(e as any)
      }
    }

    if (!document) return null

    const convId = conversationId ?? null

    return (
      // biome-ignore lint/a11y/useSemanticElements: ok
      <div
        className={cn(
          'prose prose prose-sm dark:prose-invert max-w-none break-words',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
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
  },
  (prev, next) => {
    if (prev.document === next.document) return true
    if (prev.isStreaming !== next.isStreaming) return false
    if (!next.isStreaming) return false

    // stable_nodes: reference equality works because useAgentStream
    // preserves the array reference when IDs are unchanged.
    if (prev.document?.stable_nodes !== next.document?.stable_nodes)
      return false

    // draft_nodes: content comparison (not reference — always new from JSON)
    const pd = prev.document?.draft_nodes ?? []
    const nd = next.document?.draft_nodes ?? []
    return draftNodesEqual(pd, nd)
  }
)

interface NodeRendererProps {
  node: MdNode
  messageId: string
  conversationId: string | null
  isStreaming?: boolean
  isDraft?: boolean
  scrollContainerRef?: React.RefObject<HTMLElement>
}

const NodeRenderer = memo(
  ({
    node,
    messageId,
    conversationId,
    isStreaming,
    isDraft,
    scrollContainerRef
  }: NodeRendererProps) => {
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
            {/* Fix 1: draft headings are not yet persisted — bookmarking is meaningless */}
            {!isDraft && (
              <HeadingBookmarkButton
                messageId={messageId}
                headingAnchor={node.slug}
                headingLabel={node.text}
                conversationId={conversationId}
              />
            )}
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
        return (
          <ListTag
            className="pl-5"
            dangerouslySetInnerHTML={{ __html: node.html }}
          />
        )
      }
      case 'blockquote':
        return (
          <blockquote
            className="pl-4 border-l-4 border-muted"
            dangerouslySetInnerHTML={{ __html: node.html }}
          />
        )
      case 'horizontal_rule':
        return <hr />
      case 'html_block':
        return <div dangerouslySetInnerHTML={{ __html: node.html }} />
      default:
        return null
    }
  },
  (prev, next) =>
    prev.node === next.node &&
    prev.messageId === next.messageId &&
    prev.conversationId === next.conversationId &&
    prev.isStreaming === next.isStreaming &&
    prev.isDraft === next.isDraft &&
    prev.scrollContainerRef === next.scrollContainerRef
)
