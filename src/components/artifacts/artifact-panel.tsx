import { useQuery } from '@tanstack/react-query';
import { commands } from '@/lib/bindings';
import { useUIStore } from '@/store/ui';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArtifactItem } from './artifact-item';
import { Loader2 } from 'lucide-react';

export function ArtifactPanel() {
  const activeConversationId = useUIStore((s) => s.activeConversationId);
  const activeBranchId = useUIStore((s) => s.activeBranchId);
  const { data: artifacts, isLoading } = useQuery({
    queryKey: ['artifacts', activeConversationId, activeBranchId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      const res = await commands.listArtifacts(activeConversationId, activeBranchId);
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
    enabled: !!activeConversationId,
  });

  if (!activeConversationId) {
    return <div className="p-4 text-muted-foreground text-sm">No active conversation.</div>;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="animate-spin size-4 text-muted-foreground" />
      </div>
    );
  }

  if (!artifacts || artifacts.length === 0) {
    return <div className="p-4 text-muted-foreground text-sm">No artifacts in this branch.</div>;
  }

  return (
    <ScrollArea className="h-full p-4">
      <div className="space-y-2">
        {artifacts.map((artifact) => (
          <ArtifactItem key={artifact.id} artifact={artifact} />
        ))}
      </div>
    </ScrollArea>
  );
}
