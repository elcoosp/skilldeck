import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/components/ui/toast'
import type { BookmarkData } from '@/lib/bindings'
import { useBookmarksStore } from '@/store/bookmarks'

vi.mock('@/components/ui/toast', () => ({ toast: { error: vi.fn() } }))

const { listBookmarks, toggleBookmark } = vi.hoisted(() => {
  return {
    listBookmarks: vi.fn(),
    toggleBookmark: vi.fn()
  }
})

vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return {
    ...actual,
    commands: {
      ...actual.commands,
      listBookmarks,
      toggleBookmark
    }
  }
})

const initialState = useBookmarksStore.getState()

function makeBookmark(id: string, messageId: string): BookmarkData {
  return {
    id,
    message_id: messageId,
    heading_anchor: null,
    label: 'Message',
    created_at: '2026-01-01T00:00:00Z'
  }
}

beforeEach(() => {
  useBookmarksStore.setState(initialState, true)
  listBookmarks.mockReset()
  toggleBookmark.mockReset()
  vi.mocked(toast.error).mockReset()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('loadBookmarks', () => {
  it('loads bookmarks and toggles isLoading', async () => {
    const bm = makeBookmark('b1', 'm1')
    listBookmarks.mockResolvedValue({ status: 'ok', data: [bm] })

    const promise = useBookmarksStore.getState().loadBookmarks('c1')
    expect(useBookmarksStore.getState().isLoading.c1).toBe(true)
    await promise

    expect(useBookmarksStore.getState().bookmarks.c1).toEqual([bm])
    expect(useBookmarksStore.getState().isLoading.c1).toBe(false)
  })

  it('reports toast on error status and keeps bookmarks', async () => {
    listBookmarks.mockResolvedValue({
      status: 'error',
      error: 'backend down'
    })

    await useBookmarksStore.getState().loadBookmarks('c1')

    expect(useBookmarksStore.getState().bookmarks.c1).toBeUndefined()
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Could not load bookmarks'
    )
    expect(useBookmarksStore.getState().isLoading.c1).toBe(false)
  })

  it('reports toast when the command throws', async () => {
    listBookmarks.mockRejectedValue(new Error('boom'))

    await useBookmarksStore.getState().loadBookmarks('c1')

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Could not load bookmarks'
    )
    expect(useBookmarksStore.getState().isLoading.c1).toBe(false)
  })
})

describe('addBookmark and removeBookmark', () => {
  it('addBookmark appends and replaces duplicates on (message_id, heading_anchor)', () => {
    const b1 = makeBookmark('b1', 'm1')
    const b1b = { ...b1, label: 'Updated' }
    useBookmarksStore.getState().addBookmark('c1', b1)
    useBookmarksStore.getState().addBookmark('c1', b1b)

    const arr = useBookmarksStore.getState().bookmarks.c1
    expect(arr).toHaveLength(1)
    expect(arr[0].label).toBe('Updated')
  })

  it('addBookmark keeps distinct headings of the same message', () => {
    const b1 = makeBookmark('b1', 'm1')
    const b2 = {
      ...b1,
      id: 'b2',
      heading_anchor: 'intro',
      label: 'Intro'
    }
    useBookmarksStore.getState().addBookmark('c1', b1)
    useBookmarksStore.getState().addBookmark('c1', b2)
    expect(useBookmarksStore.getState().bookmarks.c1).toHaveLength(2)
  })

  it('removeBookmark filters by id', () => {
    useBookmarksStore.getState().addBookmark('c1', makeBookmark('b1', 'm1'))
    useBookmarksStore.getState().addBookmark('c1', makeBookmark('b2', 'm2'))
    useBookmarksStore.getState().removeBookmark('c1', 'b1')
    const arr = useBookmarksStore.getState().bookmarks.c1
    expect(arr.map((b) => b.id)).toEqual(['b2'])
  })

  it('removeBookmark no-ops for a missing conversation', () => {
    useBookmarksStore.getState().removeBookmark('c1', 'b1')
    expect(useBookmarksStore.getState().bookmarks.c1).toBeUndefined()
  })
})

describe('toggleBookmark', () => {
  it('optimistically removes then keeps the server data when added', async () => {
    const bm = makeBookmark('b1', 'm1')
    useBookmarksStore.getState().addBookmark('c1', bm)
    toggleBookmark.mockResolvedValue({ status: 'ok', data: bm })

    const result = await useBookmarksStore.getState().toggleBookmark('c1', 'm1')

    expect(result).toEqual(bm)
    expect(useBookmarksStore.getState().bookmarks.c1).toEqual([bm])
  })

  it('keeps removal when the server returns data null', async () => {
    const bm = makeBookmark('b1', 'm1')
    useBookmarksStore.getState().addBookmark('c1', bm)
    toggleBookmark.mockResolvedValue({ status: 'ok', data: null })

    const result = await useBookmarksStore.getState().toggleBookmark('c1', 'm1')

    expect(result).toBeNull()
    expect(useBookmarksStore.getState().bookmarks.c1).toEqual([])
  })

  it('reverts the optimistic removal and toasts on error status', async () => {
    const bm = makeBookmark('b1', 'm1')
    useBookmarksStore.getState().addBookmark('c1', bm)
    toggleBookmark.mockResolvedValue({ status: 'error', error: 'nope' })

    const result = await useBookmarksStore.getState().toggleBookmark('c1', 'm1')

    expect(result).toBeNull()
    expect(useBookmarksStore.getState().bookmarks.c1).toEqual([bm])
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Failed to update bookmark'
    )
  })

  it('toasts on error status when there was nothing to revert', async () => {
    toggleBookmark.mockResolvedValue({ status: 'error', error: 'nope' })

    const result = await useBookmarksStore.getState().toggleBookmark('c1', 'm9')

    expect(result).toBeNull()
    expect(useBookmarksStore.getState().bookmarks.c1).toBeUndefined()
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Failed to update bookmark'
    )
  })

  it('reverts and toasts when the command throws', async () => {
    const bm = makeBookmark('b1', 'm1')
    useBookmarksStore.getState().addBookmark('c1', bm)
    toggleBookmark.mockRejectedValue(new Error('boom'))

    const result = await useBookmarksStore.getState().toggleBookmark('c1', 'm1')

    expect(result).toBeNull()
    expect(useBookmarksStore.getState().bookmarks.c1).toEqual([bm])
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      'Failed to update bookmark'
    )
  })

  it('sends the heading anchor and label through', async () => {
    toggleBookmark.mockResolvedValue({ status: 'ok', data: null })

    await useBookmarksStore
      .getState()
      .toggleBookmark('c1', 'm1', 'intro', 'Intro')

    expect(toggleBookmark).toHaveBeenCalledWith('c1', 'm1', 'intro', 'Intro')
  })

  it('defaults label to Message and anchor to null', async () => {
    toggleBookmark.mockResolvedValue({ status: 'ok', data: null })

    await useBookmarksStore.getState().toggleBookmark('c1', 'm1')

    expect(toggleBookmark).toHaveBeenCalledWith('c1', 'm1', null, 'Message')
  })
})

describe('getBookmarksForMessage', () => {
  it('filters by message id', () => {
    useBookmarksStore.getState().addBookmark('c1', makeBookmark('b1', 'm1'))
    useBookmarksStore.getState().addBookmark('c1', makeBookmark('b2', 'm2'))

    const got = useBookmarksStore.getState().getBookmarksForMessage('c1', 'm1')
    expect(got.map((b) => b.id)).toEqual(['b1'])
  })

  it('returns empty when the conversation has no bookmarks', () => {
    expect(
      useBookmarksStore.getState().getBookmarksForMessage('c1', 'm1')
    ).toEqual([])
  })
})
