import { ArtifactData } from '@/lib/bindings';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCode, FileText, Copy, GitCompare, Pin, PinOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { commands } from '@/lib/bindings';
import { useUIStore } from '@/store/ui';
import { BranchPicker } from './branch-picker';
import { VersionDiffModal } from './version-diff-modal';
import { cn } from '@/lib/utils';

interface ArtifactItemProps {
  artifact: ArtifactData;
  compact?: boolean;
  onPinChange?: () => void;
}

export function ArtifactItem({ artifact, compact = false, onPinChange }: ArtifactItemProps) {
  const Icon = artifact.type === 'code' ? FileCode : FileText;
  const qc = useQueryClient();
  const activeConversationId = useUIStore((s) => s.activeConversationId);
  const activeBranchId = useUIStore((s) => s.activeBranchId);

  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  // Fetch pinned status for this artifact in current branch
  const { data: branchPins, refetch: refetchBranchPins } = useQuery({
    queryKey: ['pinned-artifacts', activeConversationId, activeBranchId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      const res = await commands.listPinnedArtifacts(activeConversationId, activeBranchId);
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
    enabled: !!activeConversationId && !!activeBranchId,
  });
  const isBranchPinned = branchPins?.some(p => p.id === artifact.id) ?? false;

  // Fetch global pinned status
  const { data: globalPins, refetch: refetchGlobalPins } = useQuery({
    queryKey: ['global-pins', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      const res = await commands.listPinnedArtifacts(activeConversationId, null);
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
    enabled: !!activeConversationId,
  });
  const isGlobalPinned = globalPins?.some(p => p.id === artifact.id) ?? false;

  // Fetch versions for diff
  const { data: versions } = useQuery({
    queryKey: ['artifact-versions', artifact.id],
    queryFn: async () => {
      const res = await commands.listArtifactVersions(artifact.id);
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
    enabled: !!artifact.logical_key,
  });

  const handleCopy = async (branchId: string) => {
    setCopying(true);
    try {
      const res = await commands.copyArtifactToBranch(artifact.id, branchId);
      if (res.status === 'ok') {
        toast.success(`Artifact copied to branch`);
        setShowBranchPicker(false);
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCopying(false);
    }
  };

  const handlePinBranch = async () => {
    try {
      if (isBranchPinned) {
        await commands.unpinArtifact(artifact.id, activeBranchId);
        toast.success('Unpinned from this branch');
      } else {
        await commands.pinArtifact(artifact.id, activeBranchId, false);
        toast.success('Pinned to this branch');
      }
      await refetchBranchPins();
      onPinChange?.();
      qc.invalidateQueries({ queryKey: ['pinned-artifacts'] });
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handlePinGlobal = async () => {
    try {
      if (isGlobalPinned) {
        await commands.unpinArtifact(artifact.id, null);
        toast.success('Unpinned globally');
      } else {
        await commands.pinArtifact(artifact.id, null, true);
        toast.success('Pinned globally');
      }
      await refetchGlobalPins();
      onPinChange?.();
      qc.invalidateQueries({ queryKey: ['global-pins'] });
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div className={`rounded-lg border border-border ${compact ? 'p-1' : 'p-2'} hover:bg-muted/30 transition-colors`}>
      <div className="flex items-start gap-2">
        <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <p className="text-xs font-medium truncate">{artifact.name}</p>
            {!compact && (
              <>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setShowBranchPicker(!showBranchPicker)}
                  disabled={copying}
                  title="Copy to branch"
                >
                  <Copy className="size-3" />
                </button>
                {versions && versions.length >= 2 && (
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setShowDiff(true)}
                    title="Compare versions"
                  >
                    <GitCompare className="size-3" />
                  </button>
                )}
                <button
                  className={cn(
                    "text-muted-foreground hover:text-foreground",
                    isBranchPinned && "text-primary"
                  )}
                  onClick={handlePinBranch}
                  title={isBranchPinned ? "Unpin from this branch" : "Pin to this branch"}
                >
                  {isBranchPinned ? <Pin className="size-3 fill-current" /> : <PinOff className="size-3" />}
                </button>
                <button
                  className={cn(
                    "text-muted-foreground hover:text-foreground",
                    isGlobalPinned && "text-primary"
                  )}
                  onClick={handlePinGlobal}
                  title={isGlobalPinned ? "Unpin globally" : "Pin globally"}
                >
                  {isGlobalPinned ? <Pin className="size-3 fill-current" /> : <PinOff className="size-3" />}
                </button>
              </>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {artifact.language ? `${artifact.language} · ` : ''}
            {new Date(artifact.created_at).toLocaleString()}
          </p>
          {!compact && (
            <pre className="mt-1 text-[10px] text-muted-foreground bg-muted/30 p-1 rounded truncate max-h-12 overflow-hidden">
              {artifact.content.slice(0, 100)}...
            </pre>
          )}
        </div>
      </div>
      {showBranchPicker && (
        <div className="mt-2">
          <BranchPicker
            conversationId={activeConversationId!}
            onSelect={handleCopy}
            disabled={copying}
          />
        </div>
      )}
      {showDiff && versions && (
        <VersionDiffModal
          open={showDiff}
          onClose={() => setShowDiff(false)}
          versions={versions}
        />
      )}
    </div>
  );
}
