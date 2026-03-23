import { visit } from 'unist-util-visit'
import type { Root } from 'hast'
import { toString } from 'hast-util-to-string'

export function rehypeCodeMeta() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      // Only process <pre> elements that contain <code>
      if (node.tagName !== 'pre') return

      const codeNode = node.children.find((child) => child.tagName === 'code')
      if (!codeNode) return

      // Extract language from class
      const className = codeNode.properties?.className
      const langClass = Array.isArray(className)
        ? className.find((c: string) => c.startsWith('language-'))
        : null
      const language = langClass ? langClass.slice(9) : null

      // Extract code text
      const codeText = toString(codeNode)
      const lines = codeText.split('\n')
      const firstLine = lines[0] || ''

      // Detect filename from first line comment patterns
      const filenameMatch = firstLine.match(
        /^(?:\/\/|#|\/\*)\s*([\w./\\-]+\.\w+)/
      )
      const filename = filenameMatch ? filenameMatch[1] : null

      // Also look for a meta string if provided (e.g., ```tsx filename=app.tsx)
      // The meta is not directly available in the tree, but we could parse from the code node's data.
      // For simplicity, we rely on comment detection.

      if (filename) {
        node.properties = node.properties || {}
        node.properties['data-filename'] = filename
      }
      if (language) {
        node.properties = node.properties || {}
        node.properties['data-language'] = language
      }
    })
  }
}
