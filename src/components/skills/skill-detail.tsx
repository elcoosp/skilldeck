// src/components/skills/skill-detail.tsx
// Full detail view for a registry skill — shown in a panel or dialog.

import { useState, useCallback } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrustBadge, ScoreDots } from './trust-badge';
import { LintWarningPanel } from './lint-warning-panel';
import { InstallDialog } from './install-dialog';
import { ConflictResolver } from './conflict-resolver';
import { BlockedSkillAlert } from './blocked-skill-alert';
import { useInstallSkill } from '@/hooks/use-skills';
import { commands } from '@/lib/bindings';
import type { RegistrySkillData } from '@/lib/bindings';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SkillDetailProps {
  skill: RegistrySkillData | null;
  isInstalled?: boolean;
  onBack?: () => void;
  className?: string;
}

export function SkillDetail({
  skill,
  isInstalled = false,
  onBack,
  className
}: SkillDetailProps) {
  const [showInstall, setShowInstall] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [diff, setDiff] = useState<string>('');

  const install = useInstallSkill();

  const isBlocked = skill ? skill.securityScore < 2 : false;
  const isAiTagged = skill?.metadataSource === 'llm_enrichment';

  const checkForConflict = useCallback(async () => {
    if (!skill) return false;
    // Check if skill is already installed in personal location
    // Use any cast for missing commands
    const contentRes = await (commands as any).getInstalledSkillContent(skill.name, 'personal');
    if (contentRes.status === 'error') {
      toast.error('Failed to check existing installation');
      return false;
    }
    if (contentRes.data) {
      // Skill exists locally, get path and diff
      const pathRes = await (commands as any).getInstalledSkillPath(skill.name, 'personal');
      if (pathRes.status === 'ok' && pathRes.data) {
        const diffRes = await (commands as any).diffSkillVersions(pathRes.data, skill.content);
        if (diffRes.status === 'ok') {
          setDiff(diffRes.data.diff);
          setShowConflict(true);
          return true;
        }
      }
    }
    return false; // no conflict
  }, [skill]);

  const handleInstallClick = async () => {
    if (!skill) return;
    if (isBlocked) {
      setShowBlocked(true);
      return;
    }
    const hasConflict = await checkForConflict();
    if (!hasConflict) {
      setShowInstall(true);
    }
  };

  const handleOverwrite = () => {
    if (!skill) return;
    install.mutate(
      { skillName: skill.name, skillContent: skill.content, target: 'personal' },
      {
        onSuccess: () => {
          toast.success('Skill overwritten with registry version');
          setShowConflict(false);
        },
        onError: (err) => toast.error('Failed to overwrite: ' + err),
      }
    );
  };

  const handleKeepLocal = () => {
    setShowConflict(false);
  };

  const handleOpenFolder = async () => {
    try {
      await commands.openFolder(skill?.sourceUrl || '');
      // In a real scenario, we'd have a local path for installed skills
      toast.info('Opening folder...');
    } catch (error) {
      toast.error('Could not open folder');
    }
  };

  if (!skill) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="size-7">
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate">Skill not found</h2>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-4 py-4 text-sm text-muted-foreground">
            This skill could not be loaded.
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="size-7">
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-base truncate">{skill.name}</h2>
            {skill.version && (
              <span className="text-xs text-muted-foreground font-mono">
                v{skill.version}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{skill.source}</p>
        </div>
        {!isInstalled && (
          <Button size="sm" onClick={handleInstallClick}>
            Install
          </Button>
        )}
        {isInstalled && (
          <span className="text-xs font-medium text-primary">Installed</span>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-5">
          {/* Description */}
          <p className="text-sm leading-relaxed">{skill.description}</p>

          {/* Trust scores */}
          <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Security
              </span>
              <ScoreDots score={skill.securityScore} />
              <TrustBadge
                securityScore={skill.securityScore}
                qualityScore={5}
                className="mt-1"
              />
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Quality
              </span>
              <ScoreDots score={skill.qualityScore} />
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {skill.author && (
              <MetaRow label="Author" value={skill.author} />
            )}
            {skill.license && (
              <MetaRow label="License" value={skill.license} />
            )}
            {skill.category && (
              <MetaRow label="Category" value={skill.category} />
            )}
            {/* Show path if available (for installed skills) */}
            {isInstalled && (
              <div className="flex flex-col gap-0.5 col-span-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Location
                </span>
                <div className="flex items-center gap-1 text-sm">
                  <span className="truncate">{skill.sourceUrl || 'unknown path'}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleOpenFolder}
                    title="Open in file explorer"
                  >
                    <FolderOpen className="size-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {skill.tags.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                Tags
                {isAiTagged && (
                  <span className="normal-case text-[10px] bg-primary/10 text-primary px-1.5 rounded-full">
                    AI-generated
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {skill.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Lint warnings */}
          {skill.lintWarnings.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Lint Issues ({skill.lintWarnings.length})
              </h3>
              <LintWarningPanel warnings={skill.lintWarnings as any} />
            </div>
          )}

          {/* Source link */}
          {skill.sourceUrl && (
            <a
              href={skill.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" />
              View source
            </a>
          )}
        </div>
      </ScrollArea>

      {/* Dialogs */}
      {showInstall && (
        <InstallDialog skill={skill} onClose={() => setShowInstall(false)} />
      )}
      {showBlocked && (
        <BlockedSkillAlert
          skill={skill}
          onCancel={() => setShowBlocked(false)}
          onInstallAnyway={() => {
            setShowBlocked(false);
            setShowInstall(true);
          }}
        />
      )}
      {showConflict && (
        <ConflictResolver
          skillName={skill.name}
          diff={diff}
          onKeepLocal={handleKeepLocal}
          onOverwrite={handleOverwrite}
          onClose={() => setShowConflict(false)}
        />
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm truncate">{value}</span>
    </div>
  );
}
