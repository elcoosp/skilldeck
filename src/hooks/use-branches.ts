// src/hooks/use-branches.ts
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commands, CreateBranchRequest } from '@/lib/bindings';
import type { UUID } from '@/lib/types'
export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: CreateBranchRequest) => {
      const res = await commands.createBranch(req);
      if (res.status === 'error') throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}
export interface BranchInfo {
  id: UUID
  name: string | null
  parent_message_id: UUID
  created_at: string
  message_count: number
}

export function useBranches(conversationId: UUID | null) {
  return useQuery({
    queryKey: ['branches', conversationId],
    queryFn: async (): Promise<BranchInfo[]> => {
      if (!conversationId) return []
      // FIXME: commands.listBranches is not typed; assert as any until bindings are regenerated
      const res = await (commands as any).listBranches(conversationId)
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!conversationId,
    staleTime: 30_000
  })
}
