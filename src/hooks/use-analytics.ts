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
  conversations_per_day: DailyCount[]
  skills_used: SkillUsage[]
  token_usage: TokenTotals
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: async (): Promise<AnalyticsData> => {
      const res = await commands.getAnalytics()
      if (res.status === 'ok') {
        const data = res.data
        return {
          total_conversations: Number(data.total_conversations),
          total_messages: Number(data.total_messages),
          messages_per_day: data.messages_per_day.map((d) => ({
            date: d.date,
            count: Number(d.count)
          })),
          conversations_per_day: (data.conversations_per_day || []).map((d) => ({
            date: d.date,
            count: Number(d.count)
          })),
          skills_used: data.skills_used.map((s) => ({
            name: s.name,
            count: Number(s.count)
          })),
          token_usage: {
            input_tokens: Number(data.token_usage.input_tokens),
            output_tokens: Number(data.token_usage.output_tokens),
            total_tokens: Number(data.token_usage.total_tokens)
          }
        }
      }
      throw new Error(res.error)
    },
    staleTime: 60_000,
    refetchInterval: 60_000
  })
}
