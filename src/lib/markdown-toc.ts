// lib/markdown-toc.ts
import { fromMarkdown } from 'mdast-util-from-markdown'
import { visit } from 'unist-util-visit'

export interface Heading {
  id: string
  text: string
  level: number
}

/**
 * Extract headings from markdown content and generate IDs that match the ones
 * stamped in MessageBubble's heading components.
 *
 * The ID generation mimics the logic used in the React renderer:
 *   id = `heading-${counter++}-${slugified(text)}`
 */
export function extractHeadings(markdown: string): Heading[] {
  const tree = fromMarkdown(markdown)
  const headings: Heading[] = []
  let counter = 0

  visit(tree, 'heading', (node: any) => {
    // Extract plain text from heading children
    const text = node.children
      .map((child: any) => (child.type === 'text' ? child.value : ''))
      .join('')
      .trim()
    if (!text) return

    const slug = text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
    const id = `heading-${counter++}-${slug}`

    headings.push({
      id,
      text,
      level: node.depth,
    })
  })

  return headings
}
