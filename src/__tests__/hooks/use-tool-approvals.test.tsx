// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { listen } from '@tauri-apps/api/event'
import { useToolApprovalStore } from '@/store/tool-approvals'
import { useToolApprovals } from '@/hooks/use-tool-approvals'

const initialStore = useToolApprovalStore.getState()

afterEach(() => {
  cleanup()
  useToolApprovalStore.setState(initialStore, true)
})

beforeEach(() => {
  vi.mocked(listen).mockClear()
  useToolApprovalStore.setState({ pending: new Map() })
})

describe('useToolApprovals', () => {
  it('adds pending approvals only for the active conversation', async () => {
    const captures: Record<string, (...args: unknown[]) => void> = {}
    const unlisten = vi.fn()
    vi.mocked(listen).mockImplementation((eventName, handler) => {
      captures[eventName] = handler
      return Promise.resolve(unlisten)
    })
    const { unmount } = renderHook(() => useToolApprovals('c1'))
    await waitFor(() =>
      expect(captures['tool-approval-requested']).toBeDefined()
    )

    captures['tool-approval-requested']({
      payload: {
        toolCallId: 't1',
        toolName: 'shell',
        arguments: { cmd: 'ls' },
        conversationId: 'c1'
      }
    })
    captures['tool-approval-requested']({
      payload: {
        toolCallId: 't2',
        toolName: 'shell',
        arguments: {},
        conversationId: 'other'
      }
    })
    expect(useToolApprovalStore.getState().pending.has('t1')).toBe(true)
    expect(useToolApprovalStore.getState().pending.has('t2')).toBe(false)
    expect(useToolApprovalStore.getState().pending.get('t1')).toEqual({
      id: 't1',
      name: 'shell',
      arguments: { cmd: 'ls' }
    })

    unmount()
    expect(unlisten).toHaveBeenCalled()
  })

  it('subscribes to nothing while the conversation is null', () => {
    renderHook(() => useToolApprovals(null))
    expect(listen).not.toHaveBeenCalled()
  })
})