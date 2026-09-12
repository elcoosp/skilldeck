// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { toast } from '@/components/ui/toast'
import {
  getWarningCounts,
  hasSecurityIssues,
  useDisableRule,
  useLintAllLocalSources,
  useLintRules,
  useLintSkill
} from '@/hooks/use-lint'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

const commands = vi.hoisted(
  () =>
    ({
      lintSkill: vi.fn(),
      lintAllLocalSources: vi.fn(),
      getLintRules: vi.fn(),
      disableLintRule: vi.fn()
    }) as Record<string, ReturnType<typeof vi.fn>>
)
vi.mock('@/lib/bindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/bindings')>()
  return { ...actual, commands: { ...actual.commands, ...commands } }
})

afterEach(cleanup)

beforeEach(() => {
  for (const fn of Object.values(commands)) fn.mockClear()
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
})

function warning(severity: string, ruleId = 'r1') {
  return {
    rule_id: ruleId,
    severity,
    message: `msg for ${ruleId}`,
    location: '/skills/x',
    suggested_fix: 'fix it'
  }
}

describe('useLintSkill', () => {
  it('lints a single skill with the passed path', async () => {
    commands.lintSkill.mockResolvedValue({
      status: 'ok',
      data: [warning('error')]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useLintSkill('/skills/a'), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(commands.lintSkill).toHaveBeenCalledWith('/skills/a', null)
  })

  it('stays idle when the path is null without invoking', async () => {
    const client = createTestQueryClient()
    const { result } = renderHook(() => useLintSkill(null), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'))
    expect(commands.lintSkill).not.toHaveBeenCalled()
  })
})

describe('useLintAllLocalSources', () => {
  it('lints every local source', async () => {
    commands.lintAllLocalSources.mockResolvedValue({
      status: 'ok',
      data: { '/skills/a': [warning('info')] }
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useLintAllLocalSources(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toBeTruthy())
    expect(commands.lintAllLocalSources).toHaveBeenCalled()
  })
})

describe('useLintRules', () => {
  it('fetches the supported lint rules', async () => {
    commands.getLintRules.mockResolvedValue({
      status: 'ok',
      data: [{ id: 'r1', description: 'rule one' }]
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useLintRules(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(commands.getLintRules).toHaveBeenCalled()
  })
})

describe('useDisableRule', () => {
  it('disables a rule, toasts, and invalidates lint caches', async () => {
    commands.disableLintRule.mockResolvedValue({ status: 'ok', data: null })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDisableRule(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ ruleId: 'r1', scope: 'workspace' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(commands.disableLintRule).toHaveBeenCalledWith('r1', 'workspace')
    expect(toast.success).toHaveBeenCalledWith(
      'Rule "r1" disabled for workspace scope'
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['lint'] })
  })

  it('toasts an error when disabling fails', async () => {
    commands.disableLintRule.mockResolvedValue({
      status: 'error',
      error: 'nope'
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useDisableRule(), {
      wrapper: wrapper(client)
    })
    result.current.mutate({ ruleId: 'r1', scope: 'global' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to disable rule: Error: nope'
    )
  })
})

describe('severity helpers', () => {
  it('counts warnings by severity', () => {
    expect(
      getWarningCounts([
        warning('error'),
        warning('error'),
        warning('warning'),
        warning('info'),
        warning('off')
      ])
    ).toEqual({ errors: 2, warnings: 1, infos: 1, total: 4 })
  })

  it('detects security issues only on error severity', () => {
    expect(hasSecurityIssues([warning('error', 'sec-1')])).toBe(true)
    expect(hasSecurityIssues([warning('warning', 'sec-1')])).toBe(false)
    expect(hasSecurityIssues([warning('error', 'style-1')])).toBe(false)
  })
})
