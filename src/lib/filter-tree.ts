// src/lib/filter-tree.ts
import type { TreeViewElement } from '@/components/ui/file-tree'

export function filterTree(elements: TreeViewElement[], query: string): TreeViewElement[] {
  const lowerQuery = query.toLowerCase()
  const result: TreeViewElement[] = []

  for (const el of elements) {
    const matches = el.name.toLowerCase().includes(lowerQuery)
    const filteredChildren = el.children ? filterTree(el.children, query) : undefined

    if (matches || (filteredChildren && filteredChildren.length > 0)) {
      result.push({
        ...el,
        children: filteredChildren
      })
    }
  }
  return result
}
