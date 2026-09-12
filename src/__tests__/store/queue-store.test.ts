import { beforeEach, describe, expect, it } from 'vitest'
import { useQueueStore } from '@/store/queue'

const initialState = useQueueStore.getState()

beforeEach(() => {
  useQueueStore.setState(initialState, true)
  localStorage.removeItem('skilldeck-queue-ui')
})

describe('useQueueStore', () => {
  it('defaults every slice empty', () => {
    const s = useQueueStore.getState()
    expect(s.expanded).toEqual({})
    expect(s.mode).toEqual({})
    expect(s.selectedIds).toEqual({})
    expect(s.editingId).toEqual({})
    expect(s.isDragging).toEqual({})
  })

  it('setExpanded and setMode key by conversation', () => {
    useQueueStore.getState().setExpanded('c1', true)
    expect(useQueueStore.getState().expanded.c1).toBe(true)
    useQueueStore.getState().setMode('c1', 'select')
    expect(useQueueStore.getState().mode.c1).toBe('select')
  })

  it('toggleSelected adds, toggles off, and keeps array order', () => {
    useQueueStore.getState().toggleSelected('c1', 'm1')
    useQueueStore.getState().toggleSelected('c1', 'm2')
    expect(useQueueStore.getState().selectedIds.c1).toEqual(['m1', 'm2'])
    useQueueStore.getState().toggleSelected('c1', 'm1')
    expect(useQueueStore.getState().selectedIds.c1).toEqual(['m2'])
  })

  it('selectAll replaces the array', () => {
    useQueueStore.getState().toggleSelected('c1', 'm1')
    useQueueStore.getState().selectAll('c1', ['m2', 'm3'])
    expect(useQueueStore.getState().selectedIds.c1).toEqual(['m2', 'm3'])
  })

  it('clearSelected empties a conversation selection', () => {
    useQueueStore.getState().toggleSelected('c1', 'm1')
    useQueueStore.getState().clearSelected('c1')
    expect(useQueueStore.getState().selectedIds.c1).toEqual([])
  })

  it('setEditingId and setIsDragging key by conversation', () => {
    useQueueStore.getState().setEditingId('c1', 'm9')
    useQueueStore.getState().setIsDragging('c1', true)
    expect(useQueueStore.getState().editingId.c1).toBe('m9')
    expect(useQueueStore.getState().isDragging.c1).toBe(true)
  })

  it('resetQueueUI clears one conversation, leaves others intact', () => {
    useQueueStore.getState().setExpanded('c1', true)
    useQueueStore.getState().setMode('c1', 'select')
    useQueueStore.getState().toggleSelected('c1', 'm1')
    useQueueStore.getState().setEditingId('c1', 'm1')
    useQueueStore.getState().setIsDragging('c1', true)
    useQueueStore.getState().setExpanded('c2', false)
    useQueueStore.getState().setMode('c2', 'view')
    useQueueStore.getState().toggleSelected('c2', 'm2')

    useQueueStore.getState().resetQueueUI('c1')

    const s = useQueueStore.getState()
    expect(s.expanded.c1).toBeUndefined()
    expect(s.mode.c1).toBeUndefined()
    expect(s.selectedIds.c1).toBeUndefined()
    expect(s.editingId.c1).toBeUndefined()
    expect(s.isDragging.c1).toBeUndefined()
    expect(s.expanded.c2).toBe(false)
    expect(s.mode.c2).toBe('view')
    expect(s.selectedIds.c2).toEqual(['m2'])
  })
})
