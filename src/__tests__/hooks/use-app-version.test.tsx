// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useAppVersion } from '@/hooks/use-app-version'

const app = vi.hoisted(() => ({ getVersion: vi.fn() }))
vi.mock('@tauri-apps/api/app', () => app)

afterEach(cleanup)

describe('useAppVersion', () => {
  it('returns the installed version', async () => {
    app.getVersion.mockResolvedValue('1.2.3')
    const { result } = renderHook(() => useAppVersion())
    await waitFor(() => expect(result.current).toBe('1.2.3'))
  })

  it('falls back to the dev version when the call rejects', async () => {
    app.getVersion.mockRejectedValue(new Error('no app'))
    const { result } = renderHook(() => useAppVersion())
    await waitFor(() => expect(result.current).toBe('0.1.0-dev'))
  })

  it('starts null while loading', () => {
    app.getVersion.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useAppVersion())
    expect(result.current).toBeNull()
  })
})