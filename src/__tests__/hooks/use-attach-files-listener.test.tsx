// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { toast } from '@/components/ui/toast'
import { useChatContextStore } from '@/store/chat-context-store'
import { useAttachFilesListener } from '@/hooks/use-attach-files-listener'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), warning: vi.fn() }
}))

const listenMock = vi.mocked(listen)

const initialContext = useChatContextStore.getState()

afterEach(() => {
  cleanup()
  useChatContextStore.setState(initialContext, true)
})

beforeEach(() => {
  listenMock.mockClear()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.warning).mockClear()
})

function fireAttach(payload: { conversation_id: string; paths: string[] }) {
  const call = listenMock.mock.calls[listenMock.mock.calls.length - 1]
  const handler = call[1]
  act(() => handler({ payload }))
}

describe('useAttachFilesListener', () => {
  it('registers on the attach-files channel', async () => {
    renderHook(() => useAttachFilesListener())
    await waitFor(() =>
      expect(listenMock).toHaveBeenCalledWith(
        'skilldeck:attach-files',
        expect.any(Function)
      )
    )
  })

  it('deduplicates already attached paths and adds new ones', async () => {
    renderHook(() => useAttachFilesListener())
    await waitFor(() => expect(listenMock).toHaveBeenCalled())

    fireAttach({ conversation_id: 'conv-1', paths: ['/a.md', '/b.md'] })
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Attached 2 file(s)')
    )
    const items = useChatContextStore.getState().items['conv-1']
    expect(items).toHaveLength(2)
    expect(items[0].type).toBe('file')

    fireAttach({ conversation_id: 'conv-1', paths: ['/a.md', '/c.md'] })
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith('Already attached: /a.md')
    )
    await waitFor(() =>
      expect(
        useChatContextStore.getState().items['conv-1'].map((i) =>
          'path' in i.data ? i.data.path : null
        )
      ).toEqual(['/a.md', '/b.md', '/c.md'])
    )
  })
})