// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useProfileFilter } from '@/hooks/use-profile-filter'

const router = vi.hoisted(() => ({ useNavigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => router)

const root = vi.hoisted(() => ({ Route: { useSearch: vi.fn() } }))
vi.mock('@/routes/__root', () => root)

afterEach(cleanup)

describe('useProfileFilter', () => {
  it('defaults the profile id to null', () => {
    router.useNavigate.mockReturnValue(vi.fn())
    root.Route.useSearch.mockReturnValue({})
    const { result } = renderHook(() => useProfileFilter())
    expect(result.current.profileId).toBeNull()
  })

  it('reads the current profile id', () => {
    router.useNavigate.mockReturnValue(vi.fn())
    root.Route.useSearch.mockReturnValue({ profileId: 'p1' })
    const { result } = renderHook(() => useProfileFilter())
    expect(result.current.profileId).toBe('p1')
  })

  it('writes a new profile id', () => {
    const navigate = vi.fn()
    router.useNavigate.mockReturnValue(navigate)
    root.Route.useSearch.mockReturnValue({})
    const { result } = renderHook(() => useProfileFilter())
    result.current.setProfileId('p2')
    const search = navigate.mock.calls[0][0].search
    expect(search({ foo: 1 })).toEqual({ foo: 1, profileId: 'p2' })
  })

  it('clears the param when cleared', () => {
    const navigate = vi.fn()
    router.useNavigate.mockReturnValue(navigate)
    root.Route.useSearch.mockReturnValue({ profileId: 'p1' })
    const { result } = renderHook(() => useProfileFilter())
    result.current.setProfileId(null)
    const search = navigate.mock.calls[0][0].search
    expect(search({})).toEqual({ profileId: undefined })
  })
})
