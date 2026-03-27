import { useState } from 'react';
import { ArtifactData } from '@/lib/bindings';
import { FileCode, FileText, Copy } from 'lucide-react';
import { BranchPicker } from './branch-picker';
import { useUIStore } from '@/store/ui';
import { toast } from 'sonner';
import { commands } from '@/lib/bindings';
import { useQueryClient } from '@tanstack/react-query';

interface ArtifactItemProps {
  artifact: ArtifactData;
  compact?: boolean;
}

export function ArtifactItem({ artifact, compact = false }: ArtifactItemProps) {
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [copying, setCopying] = useState(false);
  const activeConversationId = useUIStore((s) => s.activeConversationId);
  const qc = useQueryClient();

  const Icon = artifact.type === 'code' ? FileCode : FileText;

  const handleCopy = async (branchId: string) => {
    setCopying(true);
    try {
      const res = await commands.copyArtifactToBranch(artifact.id, branchId);
      if (res.status === 'ok') {
        toast.success(`Artifact copied to branch`);
        setShowBranchPicker(false);
        // Invalidate queries to reflect new draft message? Not needed yet.
        qc.invalidateQueries({ queryKey: ['artifacts'] });
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className={`rounded-lg border border-border ${compact ? 'p-1' : 'p-2'} hover:bg-muted/30 transition-colors`}>
      <div className="flex items-start gap-2">
        <Icon className="size-4 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{artifact.name}</p>
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
        {!compact && (
          <div className="relative">
            <button
              className="text-muted-foreground hover:text-foreground p-1"
              onClick={() => setShowBranchPicker(!showBranchPicker)}
              disabled={copying}
              title="Copy to branch"
            >
              <Copy className="size-3" />
            </button>
            {showBranchPicker && activeConversationId && (
              <div className="absolute right-0 mt-1 z-10">
                <BranchPicker
                  conversationId={activeConversationId}
                  onSelect={handleCopy}
                  disabled={copying}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
