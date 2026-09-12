// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useExpandedFolders } from '@/hooks/use-expanded-folders'

const router = vi.hoisted(() => ({ useNavigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => router)

const root = vi.hoisted(() => ({ Route: { useSearch: vi.fn() } }))
vi.mock('@/routes/__root', () => root)

afterEach(cleanup)

describe('useExpandedFolders', () => {
  it('returns an empty list when the search param is absent', () => {
    router.useNavigate.mockReturnValue(vi.fn())
    root.Route.useSearch.mockReturnValue({})
    const { result } = renderHook(() => useExpandedFolders())
    expect(result.current.expandedFolders).toEqual([])
  })

  it('splits the comma-separated search param', () => {
    router.useNavigate.mockReturnValue(vi.fn())
    root.Route.useSearch.mockReturnValue({ expandedFolders: 'a,b,c' })
    const { result } = renderHook(() => useExpandedFolders())
    expect(result.current.expandedFolders).toEqual(['a', 'b', 'c'])
  })

  it('appends a folder on toggle', () => {
    const navigate = vi.fn()
    router.useNavigate.mockReturnValue(navigate)
    root.Route.useSearch.mockReturnValue({ expandedFolders: 'a' })
    const { result } = renderHook(() => useExpandedFolders())
    result.current.toggleFolder('b')
    const search = navigate.mock.calls[0][0].search
    expect(search({ foo: 1 })).toEqual({ foo: 1, expandedFolders: 'a,b' })
  })

  it('removes a folder on toggle when already present', () => {
    const navigate = vi.fn()
    router.useNavigate.mockReturnValue(navigate)
    root.Route.useSearch.mockReturnValue({ expandedFolders: 'a,b' })
    const { result } = renderHook(() => useExpandedFolders())
    result.current.toggleFolder('a')
    const search = navigate.mock.calls[0][0].search
    expect(search({})).toEqual({ expandedFolders: 'b' })
  })

  it('drops the param when the last folder is removed', () => {
    const navigate = vi.fn()
    router.useNavigate.mockReturnValue(navigate)
    root.Route.useSearch.mockReturnValue({ expandedFolders: 'a' })
    const { result } = renderHook(() => useExpandedFolders())
    result.current.toggleFolder('a')
    const search = navigate.mock.calls[0][0].search
    expect(search({})).toEqual({ expandedFolders: undefined })
  })
})
