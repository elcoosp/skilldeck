// src/hooks/use-platform.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listen } from '@tauri-apps/api/event'
import { useEffect } from 'react'
import { toast } from 'sonner'
import type { PlatformPreferences as ApiPlatformPreferences } from '@/lib/bindings'
import { commands } from '@/lib/bindings'

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

export interface NudgePayload {
  id: string
  message: string
  cta_label: string | null
  cta_action: string | null
}

export function usePlatformPreferences() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['platform-preferences'],
    queryFn: async (): Promise<PlatformPreferences> => {
      const res = await commands.getPlatformPreferences()
      if (res.status === 'error') throw new Error(res.error)

      const defaultPlatformUrl = import.meta.env.DEV
        ? 'http://localhost:8080'
        : 'https://platform.skilldeck.dev'

      return {
        ...res.data,
        platformEnabled: true,
        platformUrl: defaultPlatformUrl
      }
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  const update = useMutation({
    mutationFn: async (payload: UpdatePreferencesPayload) => {
      // Send only the fields the API accepts, converting undefined to null
      const apiPayload = {
        email: payload.email ?? null,
        nudge_frequency: payload.nudge_frequency ?? null,
        nudge_opt_out: payload.nudge_opt_out ?? null,
        notification_channels: payload.notification_channels ?? null,
        theme_preference: payload.theme_preference ?? null,
        timezone: payload.timezone ?? null,
        analytics_opt_in: payload.analytics_opt_in ?? null
      }

      const res = await commands.updatePlatformPreferences(apiPayload)
      if (res.status === 'error') throw new Error(res.error)

      // Here you would also persist platformEnabled and platformUrl locally
      // For now, we just return the merged result
      return {
        ...res.data,
        platformEnabled:
          payload.platformEnabled ?? query.data?.platformEnabled ?? true,
        platformUrl:
          payload.platformUrl ??
          query.data?.platformUrl ??
          'https://platform.skilldeck.dev'
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['platform-preferences'], data)
    }
  })

  const resendVerification = useMutation({
    mutationFn: async () => {
      const res = await commands.resendVerificationEmail()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    }
  })

  return {
    query,
    update,
    resendVerification
  }
}

export function useReferral() {
  const queryClient = useQueryClient()

  const stats = useQuery({
    queryKey: ['referral-stats'],
    queryFn: async () => {
      const res = await commands.getReferralStats()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    }
  })

  const create = useMutation({
    mutationFn: async () => {
      const res = await commands.createReferralCode()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-stats'] })
    }
  })

  return { stats, create }
}

export function usePlatformRegistration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await commands.ensurePlatformRegistration()
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-preferences'] })
      toast.success('Platform registration successful')
    },
    onError: (error) => {
      toast.error(`Platform registration failed: ${error}`)
    }
  })
}

export function useNudgeListener() {
  useEffect(() => {
    let unlisten: (() => void) | null = null

    const setupListener = async () => {
      try {
        unlisten = await listen<NudgePayload>('nudge://pending', (event) => {
          const { message, cta_label, cta_action } = event.payload
          toast.info(message, {
            duration: 10000,
            action:
              cta_label && cta_action
                ? {
                  label: cta_label,
                  onClick: () => {
                    // Handle CTA action - could open a URL or trigger an app navigation
                    if (cta_action.startsWith('open:')) {
                      const target = cta_action.replace('open:', '')
                      // Dispatch a custom event or use router
                      window.dispatchEvent(
                        new CustomEvent('skilldeck:navigate', {
                          detail: { target }
                        })
                      )
                    } else if (cta_action.startsWith('http')) {
                      window.open(cta_action, '_blank')
                    }
                  }
                }
                : undefined
          })
        })
      } catch (error) {
        console.error('Failed to set up nudge listener:', error)
      }
    }

    setupListener()

    return () => {
      if (unlisten) unlisten()
    }
  }, [])
}
