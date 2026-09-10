// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import {
  useAddSkillSource,
  useDiffSkillVersions,
  useDisableRule,
  useInstallSkill,
  useLocalSkills,
  useRegistrySkills,
  useRemoveSkillSource,
  useSkillsSources,
  useSyncRegistry,
  useUninstallSkill
} from '@/hooks/use-skills'

const commands = vi.hoisted(
  () =>
    ({
      syncRegistrySkills: vi.fn(),
      installSkill: vi.fn(),
      uninstallSkill: vi.fn(),
      diffSkillVersions: vi.fn(),
      disableLintRule: vi.fn(),
      listSkillSources: vi.fn(),
      addSkillSource: vi.fn(),
      removeSkillSource: vi.fn(),
      fetchRegistrySkills: vi.fn(),
      listSkills: vi.fn()
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

describe('useSyncRegistry', () => {
  it('syncs registry skills and invalidates the cache', async () => {
    commands.syncRegistrySkills.mockResolvedValue({ status: 'ok', data: 3 })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useSyncRegistry(), {
      wrapper: wrapper(client)
    })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.syncRegistrySkills).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['registry_skills']
    })
  })

  it('maps the platform-not-configured error to a constant', async () => {
    commands.syncRegistrySkills.mockResolvedValue({
      status: 'error',
      error: 'Platform not configured'
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useSyncRegistry(), {
      wrapper: wrapper(client)
    })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe(
      'PLATFORM_NOT_CONFIGURED'
    )
  })

  it('keeps other errors verbatim', async () => {
    commands.syncRegistrySkills.mockResolvedValue({
      status: 'error',
      error: 'offline'
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useSyncRegistry(), {
      wrapper: wrapper(client)
    })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('offline')
  })
})

describe('useInstallSkill', () => {
  it('installs with an explicit overwrite flag', async () => {
    commands.installSkill.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useInstallSkill(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({
      skillName: 'solo',
      skillContent: '## x',
      target: 'workspace',
      overwrite: true
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.installSkill).toHaveBeenCalledWith(
      'solo',
      '## x',
      'workspace',
      true
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['skills'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['local_skills'] })
  })

  it('defaults overwrite to null', async () => {
    commands.installSkill.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useInstallSkill(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({
      skillName: 'solo',
      skillContent: '## x',
      target: 'personal'
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.installSkill).toHaveBeenCalledWith(
      'solo',
      '## x',
      'personal',
      null
    )
  })
})

describe('useUninstallSkill', () => {
  it('uninstalls and invalidates both skill caches', async () => {
    commands.uninstallSkill.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useUninstallSkill(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ skillName: 'solo', target: 'personal' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.uninstallSkill).toHaveBeenCalledWith('solo', 'personal')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['skills'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['local_skills'] })
  })
})

describe('useDiffSkillVersions', () => {
  it('diffs local and registry content', async () => {
    commands.diffSkillVersions.mockResolvedValue({
      status: 'ok',
      data: [{ old: 'a', new: 'b' }]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useDiffSkillVersions(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ localPath: '/x', registryContent: 'body' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.diffSkillVersions).toHaveBeenCalledWith('/x', 'body')
  })
})

describe('useDisableRule (skills)', () => {
  it('invalidates lint rules and local skills', async () => {
    commands.disableLintRule.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDisableRule(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ ruleId: 'r1', scope: 'global' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['lint-rules'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['local_skills'] })
  })
})

describe('skill sources', () => {
  it('lists available sources', async () => {
    commands.listSkillSources.mockResolvedValue({
      status: 'ok',
      data: [{ id: 's1', path: '/skills' }]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useSkillsSources(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(commands.listSkillSources).toHaveBeenCalled()
  })

  it('adds a source with a label', async () => {
    commands.addSkillSource.mockResolvedValue({
      status: 'ok',
      data: { id: 's1' }
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useAddSkillSource(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ sourceType: 'local', path: '/x', label: 'X' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.addSkillSource).toHaveBeenCalledWith('local', '/x', 'X')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['skill-sources'] })
  })

  it('adds a source without a label (null)', async () => {
    commands.addSkillSource.mockResolvedValue({
      status: 'ok',
      data: { id: 's1' }
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useAddSkillSource(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ sourceType: 'local', path: '/x' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.addSkillSource).toHaveBeenCalledWith('local', '/x', null)
  })

  it('removes a source by id', async () => {
    commands.removeSkillSource.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useRemoveSkillSource(), {
      wrapper: wrapper(client)
    })
    result.current.mutate('s1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.removeSkillSource).toHaveBeenCalledWith('s1')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['skill-sources'] })
  })
})

describe('useRegistrySkills', () => {
  it('fetches registry skills with search and category', async () => {
    commands.fetchRegistrySkills.mockResolvedValue({
      status: 'ok',
      data: [{ name: 'solo' }]
    })
    const client = createTestQueryClient()
    renderHook(() => useRegistrySkills('so', 'web'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(commands.fetchRegistrySkills).toHaveBeenCalled())
    expect(commands.fetchRegistrySkills).toHaveBeenCalledWith('web', 'so')
  })

  it('keeps previous data while the next page loads', async () => {
    commands.fetchRegistrySkills.mockResolvedValue({ status: 'ok', data: [] })
    const client = createTestQueryClient()
    const { result, rerender } = renderHook(
      ({ search }: { search?: string }) => useRegistrySkills(search),
      { wrapper: wrapper(client), initialProps: { search: 'so' } }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    commands.fetchRegistrySkills.mockResolvedValue({
      status: 'ok',
      data: [{ name: 'astro' }]
    })
    rerender({ search: 'as' })
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('stays disabled when the enabled flag is false', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(
      () => useRegistrySkills(undefined, undefined, false),
      {
        wrapper: wrapper(client)
      }
    )
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(commands.fetchRegistrySkills).not.toHaveBeenCalled()
  })
})

describe('useLocalSkills', () => {
  it('lists local skills', async () => {
    commands.listSkills.mockResolvedValue({
      status: 'ok',
      data: [{ name: 'solo', source: 'local' }]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useLocalSkills(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(commands.listSkills).toHaveBeenCalled()
  })
})
