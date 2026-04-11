// src/lib/keyboard-tree-navigation.ts
import type { TreeViewElement } from '@/components/ui/file-tree'

export interface FlattenedNode {
  id: string
  name: string
  type: 'file' | 'folder'
  depth: number
  element: TreeViewElement
  parentId: string | null
}

export function flattenTree(
  elements: TreeViewElement[],
  expandedIds: Set<string>,
  parentId: string | null = null,
  depth: number = 0
): FlattenedNode[] {
  const result: FlattenedNode[] = []
  for (const el of elements) {
    const node: FlattenedNode = {
      id: el.id,
      name: el.name,
      type: el.type === 'folder' ? 'folder' : 'file',
      depth,
      element: el,
      parentId
    }
    result.push(node)
    if (el.type === 'folder' && expandedIds.has(el.id) && el.children) {
      result.push(...flattenTree(el.children, expandedIds, el.id, depth + 1))
    }
  }
  return result
}

export function getNextVisibleItem(flat: FlattenedNode[], currentIndex: number): FlattenedNode | undefined {
  return flat[currentIndex + 1]
}

export function getPrevVisibleItem(flat: FlattenedNode[], currentIndex: number): FlattenedNode | undefined {
  return flat[currentIndex - 1]
}

export function findIndexById(flat: FlattenedNode[], id: string): number {
  return flat.findIndex((n) => n.id === id)
}
