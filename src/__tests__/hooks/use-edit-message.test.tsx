// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useEditMessage } from '@/hooks/use-edit-message'

afterEach(cleanup)

describe('useEditMessage', () => {
  it('resolves with the placeholder success payload', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useEditMessage(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ messageId: 'm1', newContent: 'edited' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ success: true })
  })

  it('invalidates the messages query on success', async () => {
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useEditMessage(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ messageId: 'm1', newContent: 'edited' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['messages'] })
  })
})
