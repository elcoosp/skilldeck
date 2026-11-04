import { describe, expect, it } from 'vitest'
import type { TreeViewElement } from '@/components/ui/file-tree'
import {
  findIndexById,
  flattenTree,
  getNextVisibleItem,
  getPrevVisibleItem
} from '@/lib/keyboard-tree-navigation'

const tree: TreeViewElement[] = [
  {
    id: 'docs',
    name: 'docs',
    type: 'folder',
    children: [
      { id: 'api', name: 'api.md', type: 'file' },
      {
        id: 'nested',
        name: 'nested',
        type: 'folder',
        children: [{ id: 'deep', name: 'deep.md', type: 'file' }]
      }
    ]
  },
  { id: 'readme', name: 'readme.md', type: 'file' }
]

describe('flattenTree', () => {
  it('flattens depth-first with depth and parentId', () => {
    const flat = flattenTree(tree, new Set(['docs', 'nested']))
    expect(flat.map((n) => n.id)).toEqual([
      'docs',
      'api',
      'nested',
      'deep',
      'readme'
    ])
    expect(flat.map((n) => n.depth)).toEqual([0, 1, 1, 2, 0])
    const apiNode = flat[1]
    const deepNode = flat[3]
    const rootNode = flat[0]
    if (!apiNode || !deepNode || !rootNode) {
      throw new Error('expected the flattened tree entries')
    }
    expect(apiNode.parentId).toBe('docs')
    expect(deepNode.parentId).toBe('nested')
    expect(rootNode.parentId).toBeNull()
  })

  it('keeps folder vs file type', () => {
    const flat = flattenTree(tree, new Set(['docs']))
    const first = flat[0]
    const second = flat[1]
    if (!first || !second) {
      throw new Error('expected the flattened tree entries')
    }
    expect(first.type).toBe('folder')
    expect(second.type).toBe('file')
  })

  it('skips children of collapsed folders', () => {
    const flat = flattenTree(tree, new Set([]))
    expect(flat.map((n) => n.id)).toEqual(['docs', 'readme'])
  })

  it('skips children of a folder without a children array', () => {
    const noChildren = [{ id: 'a', name: 'a', type: 'folder' as const }]
    const flat = flattenTree(noChildren, new Set(['a']))
    expect(flat.map((n) => n.id)).toEqual(['a'])
  })
})

describe('getNextVisibleItem / getPrevVisibleItem', () => {
  const flat = flattenTree(tree, new Set(['docs']))

  it('returns the next item and undefined past the end', () => {
    expect(getNextVisibleItem(flat, 0)?.id).toBe('api')
    expect(getNextVisibleItem(flat, flat.length - 1)).toBeUndefined()
  })

  it('returns the previous item and undefined past the start', () => {
    expect(getPrevVisibleItem(flat, 1)?.id).toBe('docs')
    expect(getPrevVisibleItem(flat, 0)).toBeUndefined()
  })
})

describe('findIndexById', () => {
  const flat = flattenTree(tree, new Set(['docs']))

  it('finds a known id', () => {
    expect(findIndexById(flat, 'api')).toBe(1)
  })

  it('returns -1 for an unknown id', () => {
    expect(findIndexById(flat, 'nope')).toBe(-1)
  })
})
