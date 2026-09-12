// @vitest-environment happy-dom

import { listen } from '@tauri-apps/api/event'
import { openUrl } from '@tauri-apps/plugin-opener'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestQueryClient,
  wrapper
} from '@/__tests__/helpers/with-query-client'
import { toast } from '@/components/ui/toast'
import {
  isPlatformNotConfigured,
  useNudgeListener,
  usePlatformPreferences,
  usePlatformRegistration,
  useReferral
} from '@/hooks/use-platform'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }
}))
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn()
}))

const commands = vi.hoisted(
  () =>
    ({
      getPlatformPreferences: vi.fn(),
      updatePlatformPreferences: vi.fn(),
      resendVerificationEmail: vi.fn(),
      getReferralStats: vi.fn(),
      createReferralCode: vi.fn(),
      ensurePlatformRegistration: vi.fn()
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
  vi.mocked(toast.info).mockClear()
  vi.mocked(openUrl).mockClear()
})

const prefs = {
  email: 'a@b.c',
  nudge_frequency: 'weekly',
  nudge_opt_out: false,
  notification_channels: ['in-app'],
  theme_preference: 'system',
  timezone: 'UTC',
  analytics_opt_in: true
}

describe('usePlatformPreferences', () => {
  it('spreads platform prefs with enabled and url defaults', async () => {
    commands.getPlatformPreferences.mockResolvedValue({
      status: 'ok',
      data: prefs
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => usePlatformPreferences(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.query.data).toBeTruthy())
    expect(result.current.query.data).toMatchObject({
      email: 'a@b.c',
      platformEnabled: true,
      platformUrl: 'http://localhost:8080'
    })
  })

  it('update keeps local platformEnabled and platformUrl', async () => {
    commands.getPlatformPreferences.mockResolvedValue({
      status: 'ok',
      data: prefs
    })
    commands.updatePlatformPreferences.mockResolvedValue({
      status: 'ok',
      data: { ...prefs, email: 'new@b.c' }
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => usePlatformPreferences(), {
      wrapper: wrapper(client)
    })
    await waitFor(() => expect(result.current.query.data).toBeTruthy())
    result.current.update.mutate({ email: 'new@b.c', platformUrl: 'https://x' })
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true))
    expect(commands.updatePlatformPreferences).toHaveBeenCalledWith({
      email: 'new@b.c',
      nudge_frequency: null,
      nudge_opt_out: null,
      notification_channels: null,
      theme_preference: null,
      timezone: null,
      analytics_opt_in: null
    })
    expect(client.getQueryData(['platform-preferences'])).toMatchObject({
      email: 'new@b.c',
      platformEnabled: true,
      platformUrl: 'https://x'
    })
  })

  it('issues a verification email resend', async () => {
    commands.getPlatformPreferences.mockResolvedValue({
      status: 'ok',
      data: prefs
    })
    commands.resendVerificationEmail.mockResolvedValue({
      status: 'ok',
      data: null
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => usePlatformPreferences(), {
      wrapper: wrapper(client)
    })
    result.current.resendVerification.mutate()
    await waitFor(() =>
      expect(result.current.resendVerification.isSuccess).toBe(true)
    )
    expect(commands.resendVerificationEmail).toHaveBeenCalled()
  })
})

describe('isPlatformNotConfigured', () => {
  it('is true only when the error mentions Not configured', () => {
    expect(
      isPlatformNotConfigured({
        isError: true,
        error: new Error('Not configured: no key')
      })
    ).toBe(true)
    expect(
      isPlatformNotConfigured({
        isError: true,
        error: new Error('network down')
      })
    ).toBe(false)
    expect(isPlatformNotConfigured({ isError: false, error: null })).toBe(false)
  })
})

describe('useReferral', () => {
  it('loads referral stats', async () => {
    commands.getReferralStats.mockResolvedValue({
      status: 'ok',
      data: { code: 'ABC', use_count: 0 }
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => useReferral(), {
      wrapper: wrapper(client)
    })
    await waitFor(() =>
      expect(result.current.stats.data).toEqual({ code: 'ABC', use_count: 0 })
    )
  })

  it('creates a referral code and invalidates stats', async () => {
    commands.createReferralCode.mockResolvedValue({
      status: 'ok',
      data: { code: 'NEW' }
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useReferral(), {
      wrapper: wrapper(client)
    })
    result.current.create.mutate()
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true))
    expect(commands.createReferralCode).toHaveBeenCalled()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['referral-stats'] })
  })
})

describe('usePlatformRegistration', () => {
  it('ensures registration, invalidates prefs, and toasts success', async () => {
    commands.ensurePlatformRegistration.mockResolvedValue({
      status: 'ok',
      data: null
    })
    const client = createTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => usePlatformRegistration(), {
      wrapper: wrapper(client)
    })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['platform-preferences']
    })
    expect(toast.success).toHaveBeenCalledWith(
      'Platform registration successful'
    )
  })

  it('toasts an error on failure', async () => {
    commands.ensurePlatformRegistration.mockResolvedValue({
      status: 'error',
      error: 'boom'
    })
    const client = createTestQueryClient()
    const { result } = renderHook(() => usePlatformRegistration(), {
      wrapper: wrapper(client)
    })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith(
      'Platform registration failed: Error: boom'
    )
  })
})

describe('useNudgeListener', () => {
  it('shows a toast with a navigation action for open: actions', async () => {
    const captures: Record<string, (...args: unknown[]) => void> = {}
    vi.mocked(listen).mockImplementation((eventName, handler) => {
      captures[eventName] = handler
      return Promise.resolve(() => {})
    })
    const { unmount } = renderHook(() => useNudgeListener())
    await waitFor(() => expect(captures['nudge://pending']).toBeDefined())

    const dispatched: string[] = []
    const onNavigate = (event: Event) => {
      dispatched.push((event as CustomEvent).detail.target)
    }
    window.addEventListener('skilldeck:navigate', onNavigate)

    captures['nudge://pending']({
      payload: {
        id: 'n1',
        message: 'Try a new skill',
        cta_label: 'Go',
        cta_action: 'open:settings'
      }
    })
    expect(toast.info).toHaveBeenCalledWith(
      'Try a new skill',
      expect.objectContaining({
        duration: 10000,
        action: { label: 'Go', onClick: expect.any(Function) }
      })
    )
    const toastOptions = vi.mocked(toast.info).mock.calls[0][1]
    await toastOptions.action.onClick()
    expect(dispatched).toEqual(['settings'])

    window.removeEventListener('skilldeck:navigate', onNavigate)
    unmount()
  })

  it('opens an http url with the opener plugin', async () => {
    const captures: Record<string, (...args: unknown[]) => void> = {}
    vi.mocked(listen).mockImplementation((eventName, handler) => {
      captures[eventName] = handler
      return Promise.resolve(() => {})
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useNudgeListener())
    await waitFor(() => expect(captures['nudge://pending']).toBeDefined())

    await captures['nudge://pending']({
      payload: {
        id: 'n2',
        message: 'Visit us',
        cta_label: 'Visit',
        cta_action: 'https://example.com'
      }
    })
    const toastOptions = vi.mocked(toast.info).mock.calls[0][1]
    await toastOptions.action.onClick()
    expect(openUrl).toHaveBeenCalledWith('https://example.com')
    log.mockRestore()
  })

  it('logs when the listener setup fails', async () => {
    vi.mocked(listen).mockRejectedValue(new Error('denied'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useNudgeListener())
    await waitFor(() => expect(log).toHaveBeenCalled())
    log.mockRestore()
  })
})
