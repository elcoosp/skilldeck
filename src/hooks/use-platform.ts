import { useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { commands } from '@/lib/bindings'
import {
  listenForNudges,
  sendActivityEvent,
  type UpdatePreferencesPayload,
  type ActivityEventType
} from '@/lib/platform'

// ── Registration ──────────────────────────────────────────────────────────────

export function usePlatformRegistration() {
  return useQuery({
    queryKey: ['platform', 'registration'],
    queryFn: async () => {
      const res = await commands.ensurePlatformRegistration()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    staleTime: Infinity,
    retry: 2
  })
}

// ── Preferences ───────────────────────────────────────────────────────────────

export function usePlatformPreferences() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['platform', 'preferences'],
    queryFn: async () => {
      const res = await commands.getPlatformPreferences()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 5 * 60 * 1000
  })

  const update = useMutation({
    mutationFn: async (payload: UpdatePreferencesPayload) => {
      const updatePayload = {
        email: payload.email ?? null,
        nudge_frequency: payload.nudge_frequency ?? null,
        nudge_opt_out: payload.nudge_opt_out ?? null,
        notification_channels: payload.notification_channels ?? null,
        theme_preference: payload.theme_preference ?? null,
        timezone: payload.timezone ?? null,
        analytics_opt_in: payload.analytics_opt_in ?? null,
      }
      const res = await commands.updatePlatformPreferences(updatePayload)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (data) => {
      qc.setQueryData(['platform', 'preferences'], data)
      toast.success('Preferences saved')
    },
    onError: (err: Error) =>
      toast.error(`Failed to save preferences: ${err.message}`)
  })

  const resendVerification = useMutation({
    mutationFn: async () => {
      const res = await commands.resendVerificationEmail()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
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
    queryFn: async () => {
      const res = await commands.getReferralStats()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 60 * 1000
  })

  const create = useMutation({
    mutationFn: async () => {
      const res = await commands.createReferralCode()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'referral'] })
      sendActivityEvent('referral_link_created').catch(() => { })
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
              sendActivityEvent('nudge_clicked').catch(() => { })
              if (nudge.cta_action) {
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
      sendActivityEvent(eventType, metadata).catch(() => { })
    },
    []
  )
}
