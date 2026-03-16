// src/hooks/use-platform.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'
import type { PlatformPreferences as ApiPlatformPreferences } from '@/lib/bindings'
import { useEffect } from 'react'

// Extended platform preferences including local-only settings
export interface PlatformPreferences extends ApiPlatformPreferences {
  platformEnabled: boolean
  platformUrl: string
}

export interface UpdatePreferencesPayload {
  email?: string
  nudge_frequency?: 'daily' | 'weekly' | 'important_only'
  nudge_opt_out?: boolean
  notification_channels?: Array<'in-app' | 'email'>
  theme_preference?: 'system' | 'light' | 'dark'
  timezone?: string
  analytics_opt_in?: boolean
  platformEnabled?: boolean
  platformUrl?: string
}

export function usePlatformPreferences() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['platform-preferences'],
    queryFn: async (): Promise<PlatformPreferences> => {
      const res = await commands.getPlatformPreferences()
      if (res.status === 'error') throw new Error(res.error)

      // Merge with local defaults for platform-specific settings
      // In a real implementation, these would be stored in local DB
      return {
        ...res.data,
        platformEnabled: true, // Placeholder – read from local DB or config
        platformUrl: 'https://platform.skilldeck.dev',
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const update = useMutation({
    mutationFn: async (payload: UpdatePreferencesPayload) => {
      // Send only the fields the API accepts
      const apiPayload = {
        email: payload.email,
        nudge_frequency: payload.nudge_frequency,
        nudge_opt_out: payload.nudge_opt_out,
        notification_channels: payload.notification_channels,
        theme_preference: payload.theme_preference,
        timezone: payload.timezone,
        analytics_opt_in: payload.analytics_opt_in,
      }

      const res = await commands.updatePlatformPreferences(apiPayload)
      if (res.status === 'error') throw new Error(res.error)

      // Here you would also persist platformEnabled and platformUrl locally
      // For now, we just return the merged result
      return {
        ...res.data,
        platformEnabled: payload.platformEnabled ?? query.data?.platformEnabled ?? true,
        platformUrl: payload.platformUrl ?? query.data?.platformUrl ?? 'https://platform.skilldeck.dev',
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['platform-preferences'], data)
    },
  })

  const resendVerification = useMutation({
    mutationFn: async () => {
      const res = await commands.resendVerificationEmail()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
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
    queryFn: async () => {
      const res = await commands.getReferralStats()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const res = await commands.createReferralCode()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-stats'] })
    },
  })

  return { stats, create }
}

export function usePlatformRegistration() {
  return useMutation({
    mutationFn: async () => {
      const res = await commands.ensurePlatformRegistration()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
  })
}

export function useNudgeListener() {
  // This hook would set up the Tauri event listener for nudges
  // Implementation depends on your event system
  // We'll leave as a placeholder
  useEffect(() => {
    // Setup listener
    return () => {
      // Cleanup
    }
  }, [])
}
