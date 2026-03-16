// src/hooks/use-platform.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPlatformPreferences,
  updatePlatformPreferences,
  resendVerificationEmail,
  createReferralCode,
  getReferralStats,
  sendActivityEvent,
  ensurePlatformRegistration,
  type PlatformPreferences,
  type UpdatePreferencesPayload,
} from '@/lib/platform'

export function usePlatformPreferences() {
  const query = useQuery({
    queryKey: ['platform-preferences'],
    queryFn: getPlatformPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const queryClient = useQueryClient()
  const update = useMutation({
    mutationFn: async (payload: UpdatePreferencesPayload) => {
      const result = await updatePlatformPreferences(payload)
      return result
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['platform-preferences'], data)
    },
  })

  const resendVerification = useMutation({
    mutationFn: resendVerificationEmail,
  })

  return {
    query,
    update,
    resendVerification,
  }
}

export function useReferral() {
  const stats = useQuery({
    queryKey: ['referral-stats'],
    queryFn: getReferralStats,
    staleTime: 5 * 60 * 1000,
  })

  const create = useMutation({
    mutationFn: createReferralCode,
    onSuccess: () => {
      stats.refetch()
    },
  })

  return { stats, create }
}

export function useNudgeListener() {
  // This hook would listen for nudge events; implementation depends on the event system.
  // We'll leave it as a placeholder for now.
}

export function usePlatformRegistration() {
  return useMutation({
    mutationFn: ensurePlatformRegistration,
  })
}

export function useActivityEvent() {
  return useMutation({
    mutationFn: ({ eventType, metadata }: { eventType: string; metadata?: Record<string, unknown> }) =>
      sendActivityEvent(eventType as any, metadata),
  })
}
