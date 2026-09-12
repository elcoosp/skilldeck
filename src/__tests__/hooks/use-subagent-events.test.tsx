// @vitest-environment happy-dom

import { listen } from '@tauri-apps/api/event'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSubagentEvents } from '@/hooks/use-subagent-events'
import { useSubagentStore } from '@/store/subagent'

const initialStore = useSubagentStore.getState()

afterEach(() => {
  cleanup()
  useSubagentStore.setState(initialStore, true)
})

beforeEach(() => {
  vi.mocked(listen).mockClear()
  useSubagentStore.setState({ subagents: {} })
})

describe('useSubagentEvents', () => {
  it('updates status and result from subagent events', async () => {
    const captures: Record<string, (...args: unknown[]) => void> = {}
    const unlistenStatus = vi.fn()
    const unlistenArtifact = vi.fn()
    vi.mocked(listen).mockImplementation((eventName, handler) => {
      captures[eventName] = handler
      return Promise.resolve(
        eventName === 'subagent-status' ? unlistenStatus : unlistenArtifact
      )
    })
    const { unmount } = renderHook(() => useSubagentEvents())
    await waitFor(() => expect(captures['subagent-status']).toBeDefined())

    captures['subagent-status']({
      payload: { subagentId: 's1', status: 'running' }
    })
    expect(useSubagentStore.getState().subagents.s1).toMatchObject({
      status: 'running'
    })

    captures['subagent-artifact']({
      payload: { subagentId: 's1', artifact: { kind: 'code' } }
    })
    expect(useSubagentStore.getState().subagents.s1).toMatchObject({
      result: JSON.stringify({ kind: 'code' }),
      status: 'completed'
    })

    unmount()
    expect(unlistenStatus).toHaveBeenCalled()
    expect(unlistenArtifact).toHaveBeenCalled()
  })
})
