// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { useUnifiedSkills } from '@/hooks/use-unified-skills'

const commands = vi.hoisted(
  () =>
    ({
      listSkills: vi.fn(),
      fetchRegistrySkills: vi.fn()
    }) as Record<string, ReturnType<typeof vi.fn>>
)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

afterEach(cleanup)

beforeEach(() => {
  for (const fn of Object.values(commands)) fn.mockClear()
  commands.listSkills.mockResolvedValue({ status: 'ok', data: [] })
  commands.fetchRegistrySkills.mockResolvedValue({ status: 'ok', data: [] })
})

function regSkill(name: string) {
  return {
    id: name,
    name,
    description: `${name} description`,
    source: 'registry',
    sourceUrl: null,
    version: null,
    author: null,
    license: null,
    tags: [],
    category: null,
    lintWarnings: [],
    securityScore: 0,
    qualityScore: 0,
    metadataSource: 'test'
  }
}

function localSkill(name: string, source: string) {
  return {
    name,
    description: `${name} description`,
    is_active: true,
    source,
    path: `/skills/${name}`,
    lint_warnings: [],
    security_score: 0,
    quality_score: 0
  }
}

describe('useUnifiedSkills', () => {
  it('merges registry and local skills into sorted unified skills', async () => {
    commands.listSkills.mockResolvedValue({
      status: 'ok',
      data: [
        localSkill('web', 'registry'),
        localSkill('astro', 'local'),
        localSkill('solo', 'local'),
        localSkill('zombie', 'registry')
      ]
    })
    commands.fetchRegistrySkills.mockResolvedValue({
      status: 'ok',
      data: [regSkill('web'), regSkill('astro'), regSkill('beta')]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useUnifiedSkills({ search: '' }), {
      wrapper: wrapper(client)
    })
    await waitFor(() => {
      expect(result.current.unifiedSkills).toHaveLength(5)
    })
    const skills = result.current.unifiedSkills
    expect(skills.map((s) => s.name)).toEqual([
      'solo',
      'web',
      'zombie',
      'astro',
      'beta'
    ])
    expect(Object.fromEntries(skills.map((s) => [s.name, s.status]))).toEqual({
      solo: 'local_only',
      web: 'installed',
      zombie: 'local_only',
      astro: 'update_available',
      beta: 'available'
    })
    expect(result.current.installedCount).toBe(3)
  })

  it('only keeps the local skill when there is no registry match', async () => {
    commands.listSkills.mockResolvedValue({
      status: 'ok',
      data: [localSkill('solo', 'local')]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useUnifiedSkills(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => {
      expect(result.current.unifiedSkills).toHaveLength(1)
    })
    expect(result.current.unifiedSkills[0]).toMatchObject({
      name: 'solo',
      status: 'local_only',
      id: 'solo'
    })
  })

  it('filters client-side when the registry is offline', async () => {
    commands.listSkills.mockResolvedValue({
      status: 'ok',
      data: [localSkill('web', 'registry'), localSkill('solo', 'local')]
    })
    commands.fetchRegistrySkills.mockResolvedValue({
      status: 'ok',
      data: []
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useUnifiedSkills({ search: 'so' }), {
      wrapper: wrapper(client)
    })
    await waitFor(() => {
      expect(result.current.unifiedSkills.map((s) => s.name)).toEqual(['solo'])
    })
  })

  it('surfaces the registry error but keeps local skills', async () => {
    commands.listSkills.mockResolvedValue({
      status: 'ok',
      data: [localSkill('solo', 'local')]
    })
    commands.fetchRegistrySkills.mockResolvedValue({
      status: 'error',
      error: 'offline'
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useUnifiedSkills(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => {
      expect(result.current.registryError).toBeTruthy()
    })
    expect(result.current.unifiedSkills.map((s) => s.name)).toEqual(['solo'])
  })
})
