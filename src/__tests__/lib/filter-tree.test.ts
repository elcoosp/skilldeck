import { describe, expect, it } from 'vitest'
import type { TreeViewElement } from '@/components/ui/file-tree'
import { filterTree } from '@/lib/filter-tree'

const tree: TreeViewElement[] = [
  {
    id: 'src',
    name: 'src',
    type: 'folder',
    children: [
      { id: 'main', name: 'MAIN.ts', type: 'file' },
      { id: 'lib', name: 'lib', type: 'folder', children: [] },
      {
        id: 'tests',
        name: 'tests',
        type: 'folder',
        children: [{ id: 'spec', name: 'util.test.ts', type: 'file' }]
      }
    ]
  },
  {
    id: 'readme',
    name: 'readme.md',
    type: 'file',
    children: [{ id: 'orphan', name: 'orphan.txt', type: 'file' }]
  }
]

describe('filterTree', () => {
  it('returns everything for an empty query', () => {
    expect(filterTree(tree, '')).toEqual(tree)
  })

  it('matches by name ignoring case', () => {
    const out = filterTree(tree, 'main')
    expect(out).toHaveLength(1)
    const srcNode = out[0]
    if (!srcNode) throw new Error('expected the src folder to match')
    expect(srcNode.id).toBe('src')
    expect(srcNode.children).toHaveLength(1)
    const mainNode = srcNode.children?.[0]
    if (!mainNode) throw new Error('expected the main.ts child to be kept')
    expect(mainNode.id).toBe('main')
  })

  it('keeps parents whose children match but prunes non-matching children', () => {
    const out = filterTree(tree, 'util')
    expect(out).toHaveLength(1)
    const srcNode = out[0]
    if (!srcNode) throw new Error('expected the src folder to match')
    const tests = srcNode.children?.[0]
    expect(tests?.id).toBe('tests')
    expect(tests?.children?.map((c) => c.id)).toEqual(['spec'])
  })

  it('preserves an empty children array on retained parents', () => {
    const out = filterTree(tree, 'src')
    const src = out[0]
    if (!src) throw new Error('expected the src folder to match')
    expect(src.children).toEqual([])
    const lib = src.children?.find((c) => c.id === 'lib')
    expect(lib).toBeUndefined()
    const empty = filterTree(
      [{ id: 'x', name: 'x', type: 'folder', children: [] }],
      'x'
    )
    const emptyNode = empty[0]
    if (!emptyNode) throw new Error('expected the x folder to match')
    expect(emptyNode.children).toEqual([])
  })

  it('drops a folder with no children and no name match', () => {
    const folder = {
      id: 'empty',
      name: 'empty',
      type: 'folder' as const,
      children: []
    }
    const out = filterTree([folder], 'zzz')
    expect(out).toEqual([])
  })

  it('keeps a matching folder with empty children', () => {
    const folder = {
      id: 'empty',
      name: 'empty',
      type: 'folder' as const
    }
    const out = filterTree([folder], 'empty')
    expect(out).toHaveLength(1)
    const kept = out[0]
    if (!kept) throw new Error('expected the empty folder to match')
    expect(kept.children).toBeUndefined()
  })
})
