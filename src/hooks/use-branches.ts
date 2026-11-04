// src/hooks/use-branches.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type BranchInfo,
  type CreateBranchRequest,
  commands
} from '@/lib/bindings'
import type { UUID } from '@/lib/types'

export type { BranchInfo }

export function useCreateBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (req: CreateBranchRequest) => {
      const res = await commands.createBranch(req)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
    }
  })
}

export function useBranches(conversationId: UUID | null) {
  return useQuery({
    queryKey: ['branches', conversationId],
    queryFn: async (): Promise<BranchInfo[]> => {
      if (!conversationId) return []
      const res = await commands.listBranches(conversationId)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!conversationId,
    staleTime: 30_000
  })
}
