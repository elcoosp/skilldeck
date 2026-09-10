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
    expect(out[0].id).toBe('src')
    expect(out[0].children).toHaveLength(1)
    expect(out[0].children?.[0].id).toBe('main')
  })

  it('keeps parents whose children match but prunes non-matching children', () => {
    const out = filterTree(tree, 'util')
    expect(out).toHaveLength(1)
    const tests = out[0].children?.[0]
    expect(tests?.id).toBe('tests')
    expect(tests?.children?.map((c) => c.id)).toEqual(['spec'])
  })

  it('preserves an empty children array on retained parents', () => {
    const out = filterTree(tree, 'src')
    const src = out[0]
    expect(src.children).toEqual([])
    const lib = src.children?.find((c) => c.id === 'lib')
    expect(lib).toBeUndefined()
    const empty = filterTree(
      [{ id: 'x', name: 'x', type: 'folder', children: [] }],
      'x'
    )
    expect(empty[0].children).toEqual([])
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
    expect(out[0].children).toBeUndefined()
  })
})
