import { ArtifactData } from '@/lib/bindings';
import { FileCode, FileText, GitCompare, Copy } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { commands } from '@/lib/bindings';
import { VersionDiffModal } from './version-diff-modal';
import { toast } from 'sonner';

interface ArtifactItemProps {
  artifact: ArtifactData;
  compact?: boolean;
}

export function ArtifactItem({ artifact, compact = false }: ArtifactItemProps) {
  const Icon = artifact.type === 'code' ? FileCode : FileText;
  const [showDiff, setShowDiff] = useState(false);
  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ['artifact-versions', artifact.id],
    queryFn: async () => {
      const res = await commands.listArtifactVersions(artifact.id);
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
    enabled: !!artifact.logical_key,
  });

  const hasMultipleVersions = versions && versions.length >= 2;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    toast.success('Copied to clipboard');
  };

  return (
    <div className={`rounded-lg border border-border ${compact ? 'p-1' : 'p-2'} hover:bg-muted/30 transition-colors group`}>
      <div className="flex items-start gap-2">
        <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
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

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1 text-muted-foreground hover:text-foreground rounded"
            onClick={handleCopy}
            title="Copy content"
          >
            <Copy className="size-3" />
          </button>
          <button
            className="p-1 text-muted-foreground hover:text-foreground rounded disabled:opacity-50"
            onClick={() => setShowDiff(true)}
            disabled={!hasMultipleVersions || versionsLoading}
            title={hasMultipleVersions ? 'Compare versions' : 'Need at least 2 versions'}
          >
            <GitCompare className="size-3" />
          </button>
        </div>
      </div>

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
