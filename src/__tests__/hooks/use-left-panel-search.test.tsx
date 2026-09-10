// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLeftPanelSearch } from '@/hooks/use-left-panel-search'

const router = vi.hoisted(() => ({ useNavigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => router)

const root = vi.hoisted(() => ({ Route: { useSearch: vi.fn() } }))
vi.mock('@/routes/__root', () => root)

afterEach(cleanup)

describe('useLeftPanelSearch', () => {
  it('defaults the search to an empty string', () => {
    router.useNavigate.mockReturnValue(vi.fn())
    root.Route.useSearch.mockReturnValue({})
    const { result } = renderHook(() => useLeftPanelSearch())
    expect(result.current.leftSearch).toBe('')
  })

  it('reads the current search value', () => {
    router.useNavigate.mockReturnValue(vi.fn())
    root.Route.useSearch.mockReturnValue({ leftSearch: 'attachments' })
    const { result } = renderHook(() => useLeftPanelSearch())
    expect(result.current.leftSearch).toBe('attachments')
  })

  it('writes a new search value', () => {
    const navigate = vi.fn()
    router.useNavigate.mockReturnValue(navigate)
    root.Route.useSearch.mockReturnValue({})
    const { result } = renderHook(() => useLeftPanelSearch())
    result.current.setLeftSearch('files')
    const search = navigate.mock.calls[0][0].search
    expect(search({ foo: 1 })).toEqual({ foo: 1, leftSearch: 'files' })
  })

  it('clears the search param when the value is empty', () => {
    const navigate = vi.fn()
    router.useNavigate.mockReturnValue(navigate)
    root.Route.useSearch.mockReturnValue({ leftSearch: 'x' })
    const { result } = renderHook(() => useLeftPanelSearch())
    result.current.setLeftSearch('')
    const search = navigate.mock.calls[0][0].search
    expect(search({})).toEqual({ leftSearch: undefined })
  })
})
