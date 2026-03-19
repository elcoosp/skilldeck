/**
 * rehype plugin to linkify URLs inside <code> elements.
 * Transforms plain text URLs into clickable <a> tags.
 */

import { isElement } from 'hast-util-is-element'
import { visit } from 'unist-util-visit'

// Use 'any' for HAST types to avoid missing type definitions
type Root = any
type Element = any
type Text = any

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g

export function rehypeLinkifyCodeUrls() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (!isElement(node, 'code')) return
      if (!node.children) return

      // Process each child; we need to split text nodes that contain URLs
      const newChildren: (Element | Text)[] = []
      for (const child of node.children) {
        if (child.type !== 'text') {
          newChildren.push(child)
          continue
        }

        const text = child.value
        let lastIndex = 0
        let match: RegExpExecArray | null

        // Reset regex state
        URL_REGEX.lastIndex = 0

        while ((match = URL_REGEX.exec(text)) !== null) {
          const url = match[0]
          const start = match.index
          const end = start + url.length

          // Add text before the URL
          if (start > lastIndex) {
            newChildren.push({
              type: 'text',
              value: text.slice(lastIndex, start)
            })
          }

          // Add anchor element for the URL
          newChildren.push({
            type: 'element',
            tagName: 'a',
            properties: {
              href: url,
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'code-link'
            },
            children: [{ type: 'text', value: url }]
          })

          lastIndex = end
        }

        // Add remaining text after the last URL
        if (lastIndex < text.length) {
          newChildren.push({
            type: 'text',
            value: text.slice(lastIndex)
          })
        }
      }

      node.children = newChildren
    })
  }
}
