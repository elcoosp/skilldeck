// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useExpandedDateGroups } from '@/hooks/use-expanded-date-groups'

const router = vi.hoisted(() => ({ useNavigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => router)

const root = vi.hoisted(() => ({ Route: { useSearch: vi.fn() } }))
vi.mock('@/routes/__root', () => root)

afterEach(cleanup)

describe('useExpandedDateGroups', () => {
  it('returns an empty list when the search param is absent', () => {
    router.useNavigate.mockReturnValue(vi.fn())
    root.Route.useSearch.mockReturnValue({})
    const { result } = renderHook(() => useExpandedDateGroups())
    expect(result.current.expandedDateGroups).toEqual([])
  })

  it('splits the comma-separated search param', () => {
    router.useNavigate.mockReturnValue(vi.fn())
    root.Route.useSearch.mockReturnValue({
      expandedDateGroups: '2026-09,2026-10'
    })
    const { result } = renderHook(() => useExpandedDateGroups())
    expect(result.current.expandedDateGroups).toEqual(['2026-09', '2026-10'])
  })

  it('appends a group on toggle', () => {
    const navigate = vi.fn()
    router.useNavigate.mockReturnValue(navigate)
    root.Route.useSearch.mockReturnValue({ expandedDateGroups: '2026-09' })
    const { result } = renderHook(() => useExpandedDateGroups())
    result.current.toggleDateGroup('2026-10')
    const search = navigate.mock.calls[0][0].search
    expect(search({})).toEqual({ expandedDateGroups: '2026-09,2026-10' })
  })

  it('removes a group already present', () => {
    const navigate = vi.fn()
    router.useNavigate.mockReturnValue(navigate)
    root.Route.useSearch.mockReturnValue({
      expandedDateGroups: '2026-09,2026-10'
    })
    const { result } = renderHook(() => useExpandedDateGroups())
    result.current.toggleDateGroup('2026-09')
    const search = navigate.mock.calls[0][0].search
    expect(search({})).toEqual({ expandedDateGroups: '2026-10' })
  })

  it('drops the param when the last group is removed', () => {
    const navigate = vi.fn()
    router.useNavigate.mockReturnValue(navigate)
    root.Route.useSearch.mockReturnValue({ expandedDateGroups: '2026-09' })
    const { result } = renderHook(() => useExpandedDateGroups())
    result.current.toggleDateGroup('2026-09')
    const search = navigate.mock.calls[0][0].search
    expect(search({})).toEqual({ expandedDateGroups: undefined })
  })
})
