// src/components/conversation/pinned-bar.tsx
import { useQuery } from '@tanstack/react-query';
import { commands } from '@/lib/bindings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pin } from 'lucide-react';
import { ArtifactItem } from '../artifacts/artifact-item';
import { useConversationStore } from '@/store/conversation';

export function PinnedBar() {
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const activeBranchId = useConversationStore((s) => s.activeBranchId);

  const { data: globalPins } = useQuery({
    queryKey: ['global-pins', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      const res = await commands.listPinnedArtifacts(activeConversationId, null);
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
    enabled: !!activeConversationId,
  });

  const { data: branchPins } = useQuery({
    queryKey: ['pinned-artifacts', activeConversationId, activeBranchId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      const res = await commands.listPinnedArtifacts(activeConversationId, activeBranchId);
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
    enabled: !!activeConversationId && !!activeBranchId,
  });

  const pins = [...(globalPins || []), ...(branchPins || [])];
  if (pins.length === 0) return null;

  return (
    <div className="border-b border-border bg-muted/30 p-1 flex items-center gap-1 overflow-x-auto">
      <Pin className="size-3 text-muted-foreground ml-2 shrink-0" />
      <ScrollArea className="flex-1">
        <div className="flex gap-1">
          {pins.map(artifact => (
            <ArtifactItem key={artifact.id} artifact={artifact} compact />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
