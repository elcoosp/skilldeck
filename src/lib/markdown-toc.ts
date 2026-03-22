// lib/markdown-toc.ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'

export interface TocItem {
  id: string          // optional, may be unused
  tocIndex: number    // 0‑based position in the document
  text: string
  level: number
}

/**
 * Extract headings from markdown and assign a stable index (0, 1, 2…)
 * based on the order they appear in the document.
 */
export function extractHeadings(markdown: string, messageId: string): TocItem[] {
  if (!markdown) return []
  const tree = unified().use(remarkParse).parse(markdown)
  const headings: TocItem[] = []

  visit(tree, 'heading', (node) => {
    const text = node.children
      .map(child => (child.type === 'text' ? child.value : ''))
      .join('')
      .trim()
    if (!text) return

    const tocIndex = headings.length
    const id = `h-${messageId}-${tocIndex}` // fallback, not used for navigation
    headings.push({ id, tocIndex, level: node.depth, text })
  })
  return headings
}
