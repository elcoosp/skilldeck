// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import {
  useDeleteWorkflowDefinition,
  useRunWorkflowDefinition,
  useSaveWorkflowDefinition,
  useWorkflowDefinitions
} from '@/hooks/use-workflow-definitions'

const commands = vi.hoisted(
  () =>
    ({
      listWorkflowDefinitions: vi.fn(),
      runWorkflowDefinition: vi.fn(),
      saveWorkflowDefinition: vi.fn(),
      deleteWorkflowDefinition: vi.fn()
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

const def = {
  id: 'w1',
  name: 'review',
  definition: { steps: [] },
  created_at: '2026-01-01',
  updated_at: '2026-01-01'
}

describe('useWorkflowDefinitions', () => {
  it('lists workflow definitions', async () => {
    commands.listWorkflowDefinitions.mockResolvedValue({
      status: 'ok',
      data: [def]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useWorkflowDefinitions(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toEqual([def]))
    expect(commands.listWorkflowDefinitions).toHaveBeenCalled()
  })
})

describe('useRunWorkflowDefinition', () => {
  it('runs a definition with a null input and invalidates', async () => {
    commands.runWorkflowDefinition.mockResolvedValue({
      status: 'ok',
      data: 'instance-1'
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRunWorkflowDefinition(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('w1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.runWorkflowDefinition).toHaveBeenCalledWith('w1', null)
    expect(result.current.data).toBe('instance-1')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['workflow-definitions']
    })
  })
})

describe('useSaveWorkflowDefinition', () => {
  it('saves a definition and invalidates', async () => {
    commands.saveWorkflowDefinition.mockResolvedValue({
      status: 'ok',
      data: def
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSaveWorkflowDefinition(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ name: 'review', definition: { steps: [] } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.saveWorkflowDefinition).toHaveBeenCalledWith({
      name: 'review',
      definition: { steps: [] }
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['workflow-definitions']
    })
  })
})

describe('useDeleteWorkflowDefinition', () => {
  it('deletes a definition and invalidates', async () => {
    commands.deleteWorkflowDefinition.mockResolvedValue({
      status: 'ok',
      data: null
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteWorkflowDefinition(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('w1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.deleteWorkflowDefinition).toHaveBeenCalledWith('w1')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['workflow-definitions']
    })
  })
})
