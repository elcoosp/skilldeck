// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useMcpEvents } from '@/hooks/use-mcp-events'

const onMcpEvent = vi.hoisted(() => vi.fn())
vi.mock('@/lib/events', () => ({ onMcpEvent }))

afterEach(cleanup)

beforeEach(() => {
  onMcpEvent.mockClear()
})

describe('useMcpEvents', () => {
  it('invalidates mcp-servers on relevant event types and cleans up', async () => {
    let handleEvent: ((event: unknown) => void) | null = null
    const unlisten = vi.fn()
    onMcpEvent.mockImplementation((handler) => {
      handleEvent = handler
      return Promise.resolve(unlisten)
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { unmount } = renderHook(() => useMcpEvents(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(handleEvent).toBeDefined())

    handleEvent!({ type: 'server_connected' })
    handleEvent!({ type: 'server_disconnected' })
    handleEvent!({ type: 'tool_discovered' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['mcp-servers'] })

    invalidateSpy.mockClear()
    handleEvent!({ type: 'something_else' })
    expect(invalidateSpy).not.toHaveBeenCalled()

    unmount()
    expect(unlisten).toHaveBeenCalled()
  })
})
