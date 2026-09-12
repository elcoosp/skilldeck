// @vitest-environment happy-dom

import { listen } from '@tauri-apps/api/event'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionStats } from '@/hooks/use-session-stats'

const listenMock = vi.mocked(listen)

afterEach(cleanup)
beforeEach(() => {
  listenMock.mockClear()
})

function fireDone(payload: {
  conversation_id: string
  input_tokens?: number
  output_tokens?: number
}) {
  const call = listenMock.mock.calls[listenMock.mock.calls.length - 1]
  const handler = call[1]
  act(() => handler({ payload: { type: 'done', ...payload } }))
}

describe('useSessionStats', () => {
  it('accumulates tokens for the listened conversation', async () => {
    const { result } = renderHook(() => useSessionStats('conv-1'))
    expect(listenMock).toHaveBeenCalledWith('agent-event', expect.any(Function))
    fireDone({ conversation_id: 'conv-1', input_tokens: 10, output_tokens: 5 })
    await waitFor(() =>
      expect(result.current).toEqual({ inputTokens: 10, outputTokens: 5 })
    )
    fireDone({ conversation_id: 'conv-1', input_tokens: 1, output_tokens: 2 })
    await waitFor(() =>
      expect(result.current).toEqual({ inputTokens: 11, outputTokens: 7 })
    )
  })

  it('ignores events for other conversations', async () => {
    const { result } = renderHook(() => useSessionStats('conv-1'))
    fireDone({ conversation_id: 'conv-2', input_tokens: 99, output_tokens: 99 })
    expect(result.current).toEqual({ inputTokens: 0, outputTokens: 0 })
  })

  it('skips listening and stays zeroed for a null conversation', () => {
    renderHook(() => useSessionStats(null))
    expect(listenMock).not.toHaveBeenCalled()
  })

  it('resets when the conversation id changes to null', async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useSessionStats(id),
      { initialProps: { id: 'conv-1' as string | null } }
    )
    fireDone({ conversation_id: 'conv-1', input_tokens: 10, output_tokens: 5 })
    await waitFor(() =>
      expect(result.current).toEqual({ inputTokens: 10, outputTokens: 5 })
    )
    rerender({ id: null })
    await waitFor(() =>
      expect(result.current).toEqual({ inputTokens: 0, outputTokens: 0 })
    )
  })
})
