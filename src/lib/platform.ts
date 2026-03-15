/**
 * Platform IPC invoke wrappers.
 *
 * Type-safe bindings for all `#[tauri::command]` functions added in the
 * SkillDeck Platform integration (Chunk 1 / Chunk 6).
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { UUID } from './types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformPreferences {
  email: string | null
  email_verified: boolean
  nudge_frequency: 'daily' | 'weekly' | 'important_only'
  nudge_opt_out: boolean
  notification_channels: Array<'in-app' | 'email'>
  theme_preference: 'system' | 'light' | 'dark'
  timezone: string | null
  analytics_opt_in: boolean
}

export interface UpdatePreferencesPayload {
  email?: string
  nudge_frequency?: 'daily' | 'weekly' | 'important_only'
  nudge_opt_out?: boolean
  notification_channels?: Array<'in-app' | 'email'>
  theme_preference?: 'system' | 'light' | 'dark'
  timezone?: string
  analytics_opt_in?: boolean
}

export interface ReferralCode {
  id: UUID
  code: string
  uses: number
  max_uses: number
  created_at: string
}

export interface ReferralStats {
  code: ReferralCode
  total_signups: number
  total_conversions: number
  rewards_earned: string
}

export interface PendingNudge {
  id: UUID
  message: string
  cta_label: string | null
  cta_action: string | null
  created_at: string
}

// ── Registration ──────────────────────────────────────────────────────────────

export async function ensurePlatformRegistration(): Promise<void> {
  return invoke('ensure_platform_registration')
}

// ── Preferences ───────────────────────────────────────────────────────────────

export async function getPlatformPreferences(): Promise<PlatformPreferences> {
  return invoke('get_platform_preferences')
}

export async function updatePlatformPreferences(
  payload: UpdatePreferencesPayload
): Promise<PlatformPreferences> {
  return invoke('update_platform_preferences', { payload })
}

export async function resendVerificationEmail(): Promise<void> {
  return invoke('resend_verification_email')
}

export async function exportGdprData(): Promise<unknown> {
  return invoke('export_gdpr_data')
}

export async function deletePlatformAccount(): Promise<void> {
  return invoke('delete_platform_account')
}

// ── Referrals ─────────────────────────────────────────────────────────────────

export async function createReferralCode(): Promise<ReferralCode> {
  return invoke('create_referral_code')
}

export async function getReferralStats(): Promise<ReferralStats> {
  return invoke('get_referral_stats')
}

// ── Nudges ────────────────────────────────────────────────────────────────────

export async function getPendingNudges(): Promise<PendingNudge[]> {
  return invoke('get_pending_nudges')
}

// ── Activity events ───────────────────────────────────────────────────────────

export type ActivityEventType =
  | 'skill_created'
  | 'skill_shared'
  | 'workflow_executed'
  | 'referral_link_created'
  | 'upgrade_trigger_shown'
  | 'nudge_clicked'

export async function sendActivityEvent(
  eventType: ActivityEventType,
  metadata?: Record<string, unknown>
): Promise<void> {
  return invoke('send_activity_event', {
    payload: { event_type: eventType, metadata: metadata ?? {} }
  })
}

// ── Nudge event listener ──────────────────────────────────────────────────────

export interface NudgeEventPayload {
  id: string
  message: string
  cta_label: string | null
  cta_action: string | null
}

/** Listen for in-app nudge events emitted by the background poller. */
export function listenForNudges(
  handler: (nudge: NudgeEventPayload) => void
): Promise<() => void> {
  return listen<NudgeEventPayload>('nudge://pending', (event) => {
    handler(event.payload)
  })
}
