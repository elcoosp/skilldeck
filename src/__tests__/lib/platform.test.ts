import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createReferralCode,
  deletePlatformAccount,
  ensurePlatformRegistration,
  exportGdprData,
  getPendingNudges,
  getPlatformPreferences,
  getReferralStats,
  listenForNudges,
  resendVerificationEmail,
  sendActivityEvent,
  updatePlatformPreferences
} from '@/lib/platform'

const invokeMock = vi.mocked(invoke)
const listenMock = vi.mocked(listen)

const prefs = {
  email: null,
  email_verified: false,
  nudge_frequency: 'daily' as const,
  nudge_opt_out: false,
  notification_channels: ['in-app'] as const,
  theme_preference: 'system' as const,
  timezone: null,
  analytics_opt_in: false,
  platformEnabled: true,
  platformUrl: 'https://example.test'
}

beforeEach(() => {
  invokeMock.mockReset()
  invokeMock.mockResolvedValue(undefined)
})

describe('registration', () => {
  it('invokes ensure_platform_registration', async () => {
    await ensurePlatformRegistration()
    expect(invokeMock).toHaveBeenCalledWith('ensure_platform_registration')
  })
})

describe('preferences', () => {
  it('gets platform preferences', async () => {
    invokeMock.mockResolvedValueOnce(prefs)
    await expect(getPlatformPreferences()).resolves.toBe(prefs)
    expect(invokeMock).toHaveBeenCalledWith('get_platform_preferences')
  })

  it('updates platform preferences with the payload', async () => {
    invokeMock.mockResolvedValueOnce(prefs)
    const payload = { theme_preference: 'dark' as const }
    await expect(updatePlatformPreferences(payload)).resolves.toBe(prefs)
    expect(invokeMock).toHaveBeenCalledWith('update_platform_preferences', {
      payload
    })
  })

  it('sends the verification email again', async () => {
    await resendVerificationEmail()
    expect(invokeMock).toHaveBeenCalledWith('resend_verification_email')
  })

  it('exports GDPR data', async () => {
    invokeMock.mockResolvedValueOnce({ done: true })
    await expect(exportGdprData()).resolves.toEqual({ done: true })
    expect(invokeMock).toHaveBeenCalledWith('export_gdpr_data')
  })

  it('deletes the platform account', async () => {
    await deletePlatformAccount()
    expect(invokeMock).toHaveBeenCalledWith('delete_platform_account')
  })
})

describe('referrals', () => {
  it('creates a referral code', async () => {
    invokeMock.mockResolvedValueOnce({ id: 'r1' })
    await expect(createReferralCode()).resolves.toEqual({ id: 'r1' })
    expect(invokeMock).toHaveBeenCalledWith('create_referral_code')
  })

  it('gets referral stats', async () => {
    invokeMock.mockResolvedValueOnce({ code: { id: 'r1' } })
    await expect(getReferralStats()).resolves.toEqual({ code: { id: 'r1' } })
    expect(invokeMock).toHaveBeenCalledWith('get_referral_stats')
  })
})

describe('nudges', () => {
  it('gets pending nudges', async () => {
    invokeMock.mockResolvedValueOnce([])
    await expect(getPendingNudges()).resolves.toEqual([])
    expect(invokeMock).toHaveBeenCalledWith('get_pending_nudges')
  })
})

describe('activity events', () => {
  it('sends an activity event with metadata', async () => {
    await sendActivityEvent('workflow_executed', { workflows: 1 })
    expect(invokeMock).toHaveBeenCalledWith('send_activity_event', {
      payload: { event_type: 'workflow_executed', metadata: { workflows: 1 } }
    })
  })

  it('defaults metadata to an empty object', async () => {
    await sendActivityEvent('skill_created')
    expect(invokeMock).toHaveBeenCalledWith('send_activity_event', {
      payload: { event_type: 'skill_created', metadata: {} }
    })
  })
})

describe('listenForNudges', () => {
  it('listens on nudge://pending and forwards the payload', async () => {
    const handler = vi.fn()
    await listenForNudges(handler)
    expect(listenMock).toHaveBeenCalledWith(
      'nudge://pending',
      expect.any(Function)
    )
    const call = listenMock.mock.calls[0]
    const cb = call[1]
    cb({
      payload: { id: 'n1', message: 'hello', cta_label: null, cta_action: null }
    })
    expect(handler).toHaveBeenCalledWith({
      id: 'n1',
      message: 'hello',
      cta_label: null,
      cta_action: null
    })
  })
})
