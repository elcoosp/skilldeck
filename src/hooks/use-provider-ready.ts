import { useQuery } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'

export interface ProviderReadyInfo {
  profileId: string
  status: {
    status: 'ready' | 'not_ready'
    reason?: string
    fix_action?: string
  }
}

export function useProviderReady(profileId: string | undefined) {
  return useQuery({
    queryKey: ['provider-ready', profileId],
    queryFn: async () => {
      if (!profileId) return null
      const res = await commands.checkProviderReady(profileId)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!profileId,
    staleTime: 30_000,
    retry: false
  })
}
