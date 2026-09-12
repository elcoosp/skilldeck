// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkflowEvents } from '@/hooks/use-workflow-events'

const onWorkflowEvent = vi.hoisted(() => vi.fn())
vi.mock('@/lib/events', () => ({ onWorkflowEvent }))

afterEach(cleanup)

beforeEach(() => {
  onWorkflowEvent.mockClear()
})

describe('useWorkflowEvents', () => {
  let handleEvent: ((event: unknown) => void) | null = null
  const unlisten = vi.fn()

  const capture = (handler: (event: unknown) => void) => {
    handleEvent = handler
    return Promise.resolve(unlisten)
  }

  it('tracks progress through the workflow lifecycle', async () => {
    onWorkflowEvent.mockImplementation(capture)
    const { result, unmount } = renderHook(() => useWorkflowEvents())
    await waitFor(() => expect(handleEvent).toBeDefined())

    act(() => handleEvent!({ type: 'started', id: 'w1' }))
    expect(result.current.progress).toEqual({
      workflowId: 'w1',
      status: 'running',
      steps: {}
    })

    act(() =>
      handleEvent!({ type: 'step_started', workflow_id: 'w1', step_id: 's1' })
    )
    expect(result.current.progress?.steps.s1).toMatchObject({
      stepId: 's1',
      status: 'running'
    })

    act(() =>
      handleEvent!({
        type: 'step_completed',
        workflow_id: 'w1',
        step_id: 's1',
        result: 'ok'
      })
    )
    expect(result.current.progress?.steps.s1).toEqual({
      stepId: 's1',
      status: 'completed',
      result: 'ok'
    })

    act(() => handleEvent!({ type: 'completed', id: 'w1' }))
    expect(result.current.progress?.status).toBe('completed')

    unmount()
    expect(unlisten).toHaveBeenCalled()
  })

  it('marks a matching workflow failed with the error message', async () => {
    onWorkflowEvent.mockImplementation(capture)
    const { result } = renderHook(() => useWorkflowEvents())
    await waitFor(() => expect(handleEvent).toBeDefined())

    act(() => handleEvent!({ type: 'started', id: 'w1' }))
    act(() => handleEvent!({ type: 'failed', id: 'w1', message: 'boom' }))
    expect(result.current.progress).toMatchObject({
      status: 'failed',
      error: 'boom'
    })
  })

  it('ignores events for workflows it is not tracking', async () => {
    onWorkflowEvent.mockImplementation(capture)
    const { result } = renderHook(() => useWorkflowEvents())
    await waitFor(() => expect(handleEvent).toBeDefined())

    act(() => handleEvent!({ type: 'started', id: 'w1' }))
    act(() =>
      handleEvent!({
        type: 'step_started',
        workflow_id: 'other',
        step_id: 's9'
      })
    )
    act(() => handleEvent!({ type: 'completed', id: 'other' }))
    expect(result.current.progress?.status).toBe('running')
    expect(result.current.progress?.steps.s9).toBeUndefined()

    act(() => handleEvent!({ type: 'started' }))
    expect(result.current.progress).toBeTruthy()
  })
})
