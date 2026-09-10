// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useProviderReady } from '@/hooks/use-provider-ready'

const commands = vi.hoisted(
  () =>
    ({
      checkProviderReady: vi.fn()
    }) as Record<string, ReturnType<typeof vi.fn>>
)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

afterEach(cleanup)

beforeEach(() => {
  for (const fn of Object.values(commands)) fn.mockClear()
})

const readyInfo = {
  profileId: 'p1',
  status: { status: 'ready' }
}

describe('useProviderReady', () => {
  it('checks provider readiness when a profile is passed', async () => {
    commands.checkProviderReady.mockResolvedValue({
      status: 'ok',
      data: readyInfo
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useProviderReady('p1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toEqual(readyInfo))
    expect(commands.checkProviderReady).toHaveBeenCalledWith('p1')
  })

  it('stays idle without invoking when the profile is undefined', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useProviderReady(undefined), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(commands.checkProviderReady).not.toHaveBeenCalled()
  })

  it('surfaces a not-ready status as data', async () => {
    commands.checkProviderReady.mockResolvedValue({
      status: 'ok',
      data: {
        profileId: 'p1',
        status: {
          status: 'not_ready',
          reason: 'missing key',
          fix_action: 'add key'
        }
      }
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useProviderReady('p1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() =>
      expect(result.current.data?.status.reason).toBe('missing key')
    )
  })
})
