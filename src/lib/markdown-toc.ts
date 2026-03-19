// src/lib/markdown-toc.ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import type { Heading } from 'mdast'

export interface TocItem {
  id: string
  level: number
  text: string
}

/**
 * Extracts headings from a markdown string.
 * @param markdown - The markdown content to parse.
 * @returns An array of TocItem, each with an id (for anchoring), level, and text.
 */
export function extractHeadings(markdown: string): TocItem[] {
  if (!markdown) return []

  const tree = unified().use(remarkParse).parse(markdown)
  const headings: TocItem[] = []

  visit(tree, 'heading', (node: Heading) => {
    // Flatten the node's children to get plain text
    const text = node.children
      .map(child => (child.type === 'text' ? child.value : ''))
      .join('')
      .trim()

    if (!text) return

    // Generate a stable id from the text (slugify) – simple version
    const id = `heading-${headings.length}-${text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')}`

    headings.push({
      id,
      level: node.depth,
      text
    })
  })

  return headings
}
