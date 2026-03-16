import { useQuery } from '@tanstack/react-query';
import { commands } from '@/lib/bindings';
import type { UUID } from '@/lib/types';

export interface BranchInfo {
  id: UUID;
  name: string | null;
  parent_message_id: UUID;
  created_at: string;
  message_count: number;
}

export function useBranches(conversationId: UUID | null) {
  return useQuery({
    queryKey: ['branches', conversationId],
    queryFn: async (): Promise<BranchInfo[]> => {
      if (!conversationId) return [];
      const res = await commands.listBranches(conversationId);
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
    enabled: !!conversationId,
    staleTime: 30_000,
  });
}
