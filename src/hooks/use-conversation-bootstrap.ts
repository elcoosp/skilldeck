import { useQuery } from '@tanstack/react-query';
import { commands } from '@/lib/bindings';
import type { UUID } from '@/lib/types';
import type { MessageData } from '@/lib/bindings';
import type { BranchInfo } from '@/hooks/use-branches';
import type { QueuedMessage } from '@/hooks/use-queued-messages';
import type { HeadingItem } from '@/hooks/use-message-headings'; // we'll create this hook later

export interface ConversationBootstrapData {
  messages: MessageData[];
  branches: BranchInfo[];
  draft: [string, any[]] | null;
  queued: QueuedMessage[];
  headings: HeadingItem[];
}

export function useConversationBootstrap(conversationId: UUID | null) {
  return useQuery({
    queryKey: ['conversation-bootstrap', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const res = await commands.getConversationBootstrap(conversationId);
      if (res.status === 'ok') return res.data as ConversationBootstrapData;
      throw new Error(res.error);
    },
    enabled: !!conversationId,
    staleTime: 5000,
  });
}
