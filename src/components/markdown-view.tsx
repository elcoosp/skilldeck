// src/components/markdown-view.tsx
import { memo } from 'react'
import { NodeDocument, MdNode } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface MarkdownViewProps {
  document: NodeDocument | null  // <-- allow null
  messageId: string
  className?: string
  headingBookmarkButton: React.ComponentType<{
    messageId: string
    headingAnchor: string
    headingLabel: string
    conversationId: string | null
  }>
}

export const MarkdownView = memo(({ document, messageId, className, headingBookmarkButton: HeadingBookmarkButton }: MarkdownViewProps) => {
  // Guard against null document (e.g., during streaming before first update)
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
          HeadingBookmarkButton={HeadingBookmarkButton}
        />
      ))}
      {document.draft_nodes.map(node => (
        <NodeRenderer
          key={node.id}
          node={node}
          messageId={messageId}
          HeadingBookmarkButton={HeadingBookmarkButton}
          isDraft
        />
      ))}
    </div>
  )
})

interface NodeRendererProps {
  node: MdNode
  messageId: string
  HeadingBookmarkButton: React.ComponentType<any>
  isDraft?: boolean
}

function NodeRenderer({ node, messageId, HeadingBookmarkButton, isDraft }: NodeRendererProps) {
  switch (node.type) {
    case 'paragraph':
      return <p dangerouslySetInnerHTML={{ __html: node.html }} />
    case 'heading':
      const level = node.level as 1 | 2 | 3 | 4 | 5 | 6
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements
      return (
        <div className="group/heading relative">
          <HeadingTag id={node.slug} className="scroll-mt-12">
            {node.text}
          </HeadingTag>
          <HeadingBookmarkButton
            messageId={messageId}
            headingAnchor={node.slug}
            headingLabel={node.text}
            conversationId={null} // will be passed from context if needed
          />
        </div>
      )
    case 'code_block':
      if (isDraft) {
        return <pre className="p-2 bg-muted rounded-md overflow-x-auto"><code>{node.raw_code}</code></pre>
      }
      return (
        <div
          className="relative group/code"
          dangerouslySetInnerHTML={{ __html: node.highlighted_html }}
        />
      )
    case 'list':
      const ListTag = node.ordered ? 'ol' : 'ul'
      return <ListTag dangerouslySetInnerHTML={{ __html: node.html }} />
    case 'blockquote':
      return <blockquote dangerouslySetInnerHTML={{ __html: node.html }} />
    case 'horizontal_rule':
      return <hr />
    case 'html_block':
      return <div dangerouslySetInnerHTML={{ __html: node.html }} />
    case 'draft':
      return <pre className="whitespace-pre-wrap font-mono text-sm">{node.raw_markdown}</pre>
    default:
      return null
  }
}
