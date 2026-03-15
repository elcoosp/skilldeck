/**
 * usePlatform — central hook for all SkillDeck Platform interactions.
 *
 * Handles lazy registration, preference loading/updating, referral stats,
 * and nudge polling.  Components import this instead of calling platform
 * invoke functions directly.
 */

import { useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ensurePlatformRegistration,
  getPlatformPreferences,
  updatePlatformPreferences,
  getReferralStats,
  createReferralCode,
  resendVerificationEmail,
  sendActivityEvent,
  listenForNudges,
  type UpdatePreferencesPayload,
  type ActivityEventType
} from '@/lib/platform'

// ── Registration ──────────────────────────────────────────────────────────────

export function usePlatformRegistration() {
  return useQuery({
    queryKey: ['platform', 'registration'],
    queryFn: ensurePlatformRegistration,
    // Run once; re-run is idempotent but unnecessary.
    staleTime: Infinity,
    retry: 2
  })
}

// ── Preferences ───────────────────────────────────────────────────────────────

export function usePlatformPreferences() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['platform', 'preferences'],
    queryFn: getPlatformPreferences,
    staleTime: 5 * 60 * 1000
  })

  const update = useMutation({
    mutationFn: (payload: UpdatePreferencesPayload) =>
      updatePlatformPreferences(payload),
    onSuccess: (data) => {
      qc.setQueryData(['platform', 'preferences'], data)
      toast.success('Preferences saved')
    },
    onError: (err: Error) =>
      toast.error(`Failed to save preferences: ${err.message}`)
  })

  const resendVerification = useMutation({
    mutationFn: resendVerificationEmail,
    onSuccess: () => toast.success('Verification email sent'),
    onError: (err: Error) => toast.error(err.message)
  })

  return { query, update, resendVerification }
}

// ── Referrals ─────────────────────────────────────────────────────────────────

export function useReferral() {
  const qc = useQueryClient()

  const stats = useQuery({
    queryKey: ['platform', 'referral', 'stats'],
    queryFn: getReferralStats,
    staleTime: 60 * 1000
  })

  const create = useMutation({
    mutationFn: createReferralCode,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'referral'] })
      sendActivityEvent('referral_link_created').catch(() => {})
      toast.success('Referral code created!')
    }
  })

  return { stats, create }
}

// ── Nudge listener ────────────────────────────────────────────────────────────

export function useNudgeListener() {
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listenForNudges((nudge) => {
      toast(nudge.message, {
        duration: 8000,
        action: nudge.cta_label
          ? {
              label: nudge.cta_label,
              onClick: () => {
                sendActivityEvent('nudge_clicked').catch(() => {})
                if (nudge.cta_action) {
                  // cta_action format: "open:tab" e.g. "open:referral"
                  const [, target] = nudge.cta_action.split(':')
                  window.dispatchEvent(
                    new CustomEvent('skilldeck:navigate', {
                      detail: { tab: target }
                    })
                  )
                }
              }
            }
          : undefined
      })
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [])
}

// ── Activity event helper ─────────────────────────────────────────────────────

export function useTrackEvent() {
  return useCallback(
    (eventType: ActivityEventType, metadata?: Record<string, unknown>) => {
      sendActivityEvent(eventType, metadata).catch(() => {})
    },
    []
  )
}
