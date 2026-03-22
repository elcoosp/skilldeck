// lib/markdown-toc.ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import type { Heading } from 'mdast'

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
  console.log(`[extractHeadings] msgId=${messageId.slice(0, 8)} input length=${markdown.length}`)
  const tree = unified().use(remarkParse).parse(markdown)
  const headings: TocItem[] = []

  visit(tree, 'heading', (node: Heading) => {
    const text = node.children
      .map(child => (child.type === 'text' ? child.value : ''))
      .join('')
      .trim()
    if (!text) return

    const tocIndex = headings.length
    const id = `h-${messageId}-${tocIndex}` // fallback, not used for navigation
    console.log(`[extractHeadings] idx=${tocIndex} id="${id}" level=${node.depth} text="${text.slice(0, 50)}"`)
    headings.push({ id, tocIndex, level: node.depth, text })
  })
  console.log(`[extractHeadings] total headings = ${headings.length}`)
  return headings
}
