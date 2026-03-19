// src/hooks/use-analytics.ts
import { useQuery } from '@tanstack/react-query'
import { commands } from '@/lib/bindings'

export interface DailyCount {
  date: string
  count: number
}

export interface SkillUsage {
  name: string
  count: number
}

export interface TokenTotals {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export interface AnalyticsData {
  total_conversations: number
  total_messages: number
  messages_per_day: DailyCount[]
  skills_used: SkillUsage[]
  token_usage: TokenTotals
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: async (): Promise<AnalyticsData> => {
      const res = await commands.getAnalytics()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    staleTime: 60_000, // refresh every minute
    refetchInterval: 60_000
  })
}
