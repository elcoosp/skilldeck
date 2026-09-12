// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useSkillEvents } from '@/hooks/use-skill-events'

const onSkillEvent = vi.hoisted(() => vi.fn())
vi.mock('@/lib/events', () => ({ onSkillEvent }))

afterEach(cleanup)

beforeEach(() => {
  onSkillEvent.mockClear()
})

describe('useSkillEvents', () => {
  it('refreshes local skills on any skill event and cleans up', async () => {
    let handleEvent: ((event: unknown) => void) | null = null
    const unlisten = vi.fn()
    onSkillEvent.mockImplementation((handler) => {
      handleEvent = handler
      return Promise.resolve(unlisten)
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { unmount } = renderHook(() => useSkillEvents(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(handleEvent).toBeDefined())

    handleEvent!({ type: 'skill_updated' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['local_skills'] })

    unmount()
    expect(unlisten).toHaveBeenCalled()
  })
})
