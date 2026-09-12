// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useArtifactContent } from '@/hooks/use-artifact-content'

const commands = vi.hoisted(
  () =>
    ({
      getArtifactContent: vi.fn()
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

describe('useArtifactContent', () => {
  it('fetches immutable artifact content', async () => {
    commands.getArtifactContent.mockResolvedValue({
      status: 'ok',
      data: { content: 'artifact body' }
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useArtifactContent('a1'), {
      wrapper: wrapper(client)
    })
    await waitFor(() =>
      expect(result.current.data).toEqual({ content: 'artifact body' })
    )
    expect(commands.getArtifactContent).toHaveBeenCalledWith('a1')
  })

  it('stays disabled without an artifact id', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useArtifactContent(null), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(commands.getArtifactContent).not.toHaveBeenCalled()
  })
})
