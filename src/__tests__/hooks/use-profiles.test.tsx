// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import {
  useCreateProfile,
  useDeleteProfile,
  useProfiles,
  useRestoreProfile,
  useSetDefaultProfile,
  useUpdateProfile
} from '@/hooks/use-profiles'

const commands = vi.hoisted(
  () =>
    ({
      listProfiles: vi.fn(),
      createProfile: vi.fn(),
      updateProfile: vi.fn(),
      deleteProfile: vi.fn(),
      setDefaultProfile: vi.fn(),
      restoreProfile: vi.fn()
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

const profile = { id: 'p1', name: 'Default', is_default: true }

describe('useProfiles', () => {
  it('returns profiles for the includeDeleted flag', async () => {
    commands.listProfiles.mockResolvedValue({ status: 'ok', data: [profile] })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useProfiles(true), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toEqual([profile]))
    expect(commands.listProfiles).toHaveBeenCalledWith(true)
  })

  it('defaults includeDeleted to false', async () => {
    commands.listProfiles.mockResolvedValue({ status: 'ok', data: [] })
    const client = createTestQueryClient()
    renderHook(() => useProfiles(), { wrapper: wrapper(client) })
    await waitFor(() =>
      expect(commands.listProfiles).toHaveBeenCalledWith(false)
    )
  })

  it('surfaces an error', async () => {
    commands.listProfiles.mockResolvedValue({ status: 'error', error: 'x' })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useProfiles(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCreateProfile', () => {
  it('creates a profile and invalidates the list', async () => {
    commands.createProfile.mockResolvedValue({ status: 'ok', data: profile })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateProfile(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({
      name: 'Default',
      modelProvider: 'openai',
      modelId: 'gpt-4',
      systemPrompt: 'be brief'
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.createProfile).toHaveBeenCalledWith(
      'Default',
      'openai',
      'gpt-4',
      'be brief'
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profiles'] })
  })

  it('defaults the system prompt to null', async () => {
    commands.createProfile.mockResolvedValue({ status: 'ok', data: profile })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useCreateProfile(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ name: 'D', modelProvider: 'o', modelId: 'g' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.createProfile).toHaveBeenCalledWith('D', 'o', 'g', null)
  })
})

describe('useUpdateProfile', () => {
  it('updates a profile with nullable field defaults', async () => {
    commands.updateProfile.mockResolvedValue({ status: 'ok', data: profile })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ id: 'p1', name: 'Renamed' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.updateProfile).toHaveBeenCalledWith(
      'p1',
      'Renamed',
      null,
      null,
      null
    )
  })
})

describe('useDeleteProfile', () => {
  it('deletes a profile and invalidates the list', async () => {
    commands.deleteProfile.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteProfile(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('p1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.deleteProfile).toHaveBeenCalledWith('p1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profiles'] })
  })
})

describe('useSetDefaultProfile', () => {
  it('sets the default profile with a full refetch', async () => {
    commands.setDefaultProfile.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSetDefaultProfile(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('p1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.setDefaultProfile).toHaveBeenCalledWith('p1')
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['profiles'],
      refetchType: 'all'
    })
  })
})

describe('useRestoreProfile', () => {
  it('restores a profile and invalidates the list', async () => {
    commands.restoreProfile.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRestoreProfile(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('p1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.restoreProfile).toHaveBeenCalledWith('p1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profiles'] })
  })
})
