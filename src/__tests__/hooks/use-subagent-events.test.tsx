// @vitest-environment happy-dom

import { type EventCallback, listen } from '@tauri-apps/api/event'
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
    const captures: Record<string, EventCallback<unknown>> = {}
    const unlistenStatus = vi.fn<() => void>()
    const unlistenArtifact = vi.fn<() => void>()
    vi.mocked(listen).mockImplementation((eventName, handler) => {
      captures[eventName] = handler
      return Promise.resolve(
        eventName === 'subagent-status' ? unlistenStatus : unlistenArtifact
      )
    })
    const { unmount } = renderHook(() => useSubagentEvents())
    await waitFor(() => expect(captures['subagent-status']).toBeDefined())
    const statusHandler = captures['subagent-status']
    if (!statusHandler) throw new Error('expected a subagent-status listener')
    statusHandler({
      event: 'subagent-status',
      id: 0,
      payload: { subagentId: 's1', status: 'running' }
    })
    expect(useSubagentStore.getState().subagents.s1).toMatchObject({
      status: 'running'
    })

    const artifactHandler = captures['subagent-artifact']
    if (!artifactHandler)
      throw new Error('expected a subagent-artifact listener')
    artifactHandler({
      event: 'subagent-artifact',
      id: 0,
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
