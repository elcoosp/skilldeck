// src/components/skills/skill-detail-panel.tsx
// Side panel shown when a unified skill card is selected.
// Supports install, uninstall, open-folder, sync, lint warnings, conflict resolution,
// blocked skill alerts, and platform awareness.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Share2,
  Trash2
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useDisableRule } from '@/hooks/use-skills'
import type { LintWarning } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import { DOCS_LINT_URL } from '@/lib/config'
import { useUIPersistentStore } from '@/store/ui-state'
import type { UnifiedSkill } from '@/types/skills'
import { BlockedSkillAlert } from './blocked-skill-alert'
import { ConflictResolver } from './conflict-resolver'
import { InstallDialog } from './install-dialog'
import { LintWarningPanel } from './lint-warning-panel'
import { ShareSkillModal } from './share-skill-modal'
import { TrustBadge } from './trust-badge'

interface Props {
  skill: UnifiedSkill
  onClose: () => void
}

// Helper for score bars
function ScoreBar({ score, max = 5, color }: { score: number; max?: number; color: string }) {
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${(score / max) * 100}%` }}
      />
    </div>
  )
}

export function SkillDetailPanel({ skill, onClose }: Props) {
  const qc = useQueryClient()
  const platformFeaturesEnabled = useUIPersistentStore(
    (s) => s.platformFeaturesEnabled
  )
  const lintSectionRef = useRef<HTMLDivElement>(null)

  const [actionError, setActionError] = useState<string | null>(null)
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [showBlockedAlert, setShowBlockedAlert] = useState(false)
  const [showConflictResolver, setShowConflictResolver] = useState(false)
  const [diff, setDiff] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [skillContent, setSkillContent] = useState('')
  const [loadingContent, setLoadingContent] = useState(false)

  const isInstalled =
    skill.status === 'installed' || skill.status === 'local_only'
  const canInstall =
    !!skill.registryData && !isInstalled && platformFeaturesEnabled
  const canUpdate =
    skill.status === 'update_available' && platformFeaturesEnabled
  const isBlocked = skill.registryData && skill.registryData.securityScore < 2

  // Combine lint warnings from both sources
  const lintWarnings = (skill.localData?.lint_warnings ??
    skill.registryData?.lintWarnings ??
    []) as LintWarning[]

  // Determine active source and shadowed source
  const getSourceInfo = () => {
    let activeSource = 'unknown'
    let shadowedSource: string | null = null

    if (skill.status === 'installed' || skill.status === 'update_available') {
      // Local source (workspace or personal)
      if (skill.localData) {
        activeSource =
          skill.localData.source === 'workspace' ? 'Workspace' : 'Personal'
      }
      // If registry data also exists, local shadows registry
      if (skill.registryData) {
        shadowedSource = 'Registry'
      }
    } else if (skill.status === 'local_only') {
      activeSource =
        skill.localData?.source === 'workspace' ? 'Workspace' : 'Personal'
      // No shadowing because registry doesn't have it
    } else if (skill.status === 'available') {
      activeSource = 'Registry'
      // Check if there is also a local version? Not possible with 'available' status.
    }
    return { activeSource, shadowedSource }
  }

  const { activeSource, shadowedSource } = getSourceInfo()

  // Scroll to lint warnings section
  const scrollToLint = () => {
    lintSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  // ── Install ────────────────────────────────────────────────────────────────
  const install = useMutation({
    mutationFn: async ({
      target,
      overwrite
    }: {
      target: 'personal' | 'workspace'
      overwrite?: boolean
    }) => {
      if (!skill.registryData) throw new Error('No registry data')
      const res = await commands.installSkill(
        skill.registryData.name,
        skill.registryData.content,
        target,
        overwrite ?? null
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      setActionError(null)
      qc.invalidateQueries({ queryKey: ['local_skills'] })
      qc.invalidateQueries({ queryKey: ['registry_skills'] })
      toast.success('Skill installed successfully')
    },
    onError: (e: Error) => {
      setActionError(e.message)
      toast.error(`Install failed: ${e.message}`)
    }
  })

  // ── Uninstall ──────────────────────────────────────────────────────────────
  const uninstall = useMutation({
    mutationFn: async () => {
      const res = await commands.uninstallSkill(skill.name, 'personal')
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      setActionError(null)
      qc.invalidateQueries({ queryKey: ['local_skills'] })
      toast.success('Skill uninstalled')
    },
    onError: (e: Error) => {
      setActionError(e.message)
      toast.error(`Uninstall failed: ${e.message}`)
    }
  })

  // ── Sync ──────────────────────────────────────────────────────────────────
  const sync = useMutation({
    mutationFn: async () => {
      const res = await commands.syncRegistrySkills()
      if (res.status === 'error') throw new Error(res.error)
    },
    onSuccess: () => {
      setActionError(null)
      qc.invalidateQueries({ queryKey: ['registry_skills'] })
      qc.invalidateQueries({ queryKey: ['local_skills'] })
      toast.success('Registry synced')
    },
    onError: (e: Error) => {
      setActionError(e.message)
      toast.error(`Sync failed: ${e.message}`)
    }
  })

  // ── Re-lint (for local skills) ─────────────────────────────────────────────
  const relint = useMutation({
    mutationFn: async () => {
      if (!skill.localData?.path) throw new Error('No path')
      const res = await commands.lintSkill(skill.localData.path, null)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['local_skills'] })
      toast.success('Lint check complete')
    },
    onError: (e: Error) => toast.error(`Lint failed: ${e.message}`)
  })

  // ── Diff / Conflict resolution ─────────────────────────────────────────────
  const diffMutation = useMutation({
    mutationFn: async () => {
      if (!skill.registryData || !skill.localData?.path) {
        throw new Error('Cannot compute diff')
      }
      const res = await commands.diffSkillVersions(
        skill.localData.path,
        skill.registryData.content
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: (data) => {
      setDiff(data.diff)
      setShowConflictResolver(true)
    },
    onError: (e: Error) => {
      toast.error(`Failed to compute diff: ${e.message}`)
    }
  })

  // ── Disable rule (for lint warnings) ───────────────────────────────────────
  const disableRule = useDisableRule()

  const handleIgnoreRule = (ruleId: string) => {
    disableRule.mutate(
      { ruleId, scope: 'workspace' },
      {
        onSuccess: () => relint.mutate()
      }
    )
  }
  // ── Share skill ───────────────────────────────────────────────────────────
  const handleShareClick = async () => {
    if (!skill.localData?.path) return
    setLoadingContent(true)
    try {
      const res = await commands.getInstalledSkillContent(
        skill.name,
        'personal'
      )
      if (res.status === 'ok' && res.data) {
        setSkillContent(res.data)
        setShowShareModal(true)
      } else {
        toast.error('Could not read skill content')
      }
    } catch (err) {
      toast.error(`Failed to fetch skill: ${err}`)
    } finally {
      setLoadingContent(false)
    }
  }

  const isBusy =
    install.isPending ||
    uninstall.isPending ||
    sync.isPending ||
    diffMutation.isPending ||
    relint.isPending ||
    loadingContent

  const handleInstallClick = () => {
    if (!skill.registryData) return
    if (isBlocked) {
      setShowBlockedAlert(true)
    } else {
      setShowInstallDialog(true)
    }
  }

  const handleUpdateClick = () => {
    diffMutation.mutate()
  }

  const handleOverwrite = (target: 'personal' | 'workspace') => {
    install.mutate({ target, overwrite: true })
    setShowConflictResolver(false)
  }

  const handleKeepLocal = () => {
    setShowConflictResolver(false)
  }

  const handleOpenFolder = async () => {
    if (!skill.localData?.path) return
    try {
      await revealItemInDir(skill.localData.path)
    } catch (err) {
      toast.error(`Could not open folder: ${err}`)
    }
  }

  // Compute security/quality scores for display
  const securityScore =
    skill.localData?.security_score ?? skill.registryData?.securityScore ?? 5
  const qualityScore =
    skill.localData?.quality_score ?? skill.registryData?.qualityScore ?? 5

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-background overflow-hidden">
      {/* Header with back button on the left */}
      <div className="p-4 border-b flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-7 w-7 -ml-1"
          onClick={onClose}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm leading-snug truncate">
            {skill.name}
          </h2>
          <p className="text-xs text-muted-foreground truncate capitalize flex items-center gap-2">
            <span>{skill.status.replace('_', ' ')}</span>
            {skill.registryData?.version && (
              <span className="ml-1.5 opacity-70 font-mono">
                v{skill.registryData.version}
              </span>
            )}
            {!platformFeaturesEnabled && (
              <Badge variant="outline" className="text-[9px] h-4 px-1">
                platform off
              </Badge>
            )}
          </p>
        </div>
      </div>

      {/* Body — now includes actions at the bottom */}
      <div className="flex-1 overflow-y-auto p-4 min-w-0 space-y-5 text-sm thin-scrollbar">
        {/* Source info */}
        {activeSource !== 'unknown' && (
          <div>
            <SectionLabel>Source</SectionLabel>
            <div className="text-xs flex items-center gap-1">
              <span className="font-medium capitalize">{activeSource}</span>
              {shadowedSource && (
                <span className="text-muted-foreground text-[10px]">
                  (shadows {shadowedSource})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Trust badge with click handler */}
        <div>
          <TrustBadge
            securityScore={securityScore}
            qualityScore={qualityScore}
            onClick={scrollToLint}
          />
        </div>

        {/* Description */}
        <div>
          <SectionLabel>Description</SectionLabel>
          <p className="text-sm leading-relaxed text-foreground/90 break-words">
            {skill.description || (
              <span className="text-muted-foreground italic">
                No description provided
              </span>
            )}
          </p>
        </div>

        {/* Meta grid */}
        {skill.registryData && (
          <div>
            <SectionLabel>Metadata</SectionLabel>
            <div className="flex flex-col gap-2">
              <MetaField label="Author" value={skill.registryData.author ?? 'Unknown'} />
              <MetaField label="Version" value={skill.registryData.version ?? 'N/A'} />
              <MetaField label="License" value={skill.registryData.license ?? 'Unspecified'} />
              <MetaField label="Category" value={skill.registryData.category ?? 'General'} />
            </div>
          </div>
        )}

        {/* Trust scores with progress bars */}
        <div>
          <SectionLabel>Trust scores</SectionLabel>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Security</span>
                <span className="font-medium">{securityScore}/5</span>
              </div>
              <ScoreBar score={securityScore} color="bg-teal-500" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-muted-foreground mt-0.5 inline-block">
                    Based on security lint rules
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>5 = no security errors, 1 = critical errors.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Quality</span>
                <span className="font-medium">{qualityScore}/5</span>
              </div>
              <ScoreBar score={qualityScore} color="bg-amber-500" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-muted-foreground mt-0.5 inline-block">
                    Based on documentation and style
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>5 = no quality warnings, 1 = many warnings.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Tags */}
        {skill.registryData?.tags && skill.registryData.tags.length > 0 && (
          <div>
            <SectionLabel>Tags</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {skill.registryData.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-2">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Lint warnings section with ref */}
        {lintWarnings.length > 0 && (
          <div ref={lintSectionRef}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <SectionLabel>Lint Issues</SectionLabel>
              </div>
              <button
                type="button"
                onClick={() => openUrl(DOCS_LINT_URL)}
                className="text-xs text-primary hover:underline"
              >
                Learn more
              </button>
            </div>
            <LintWarningPanel
              warnings={lintWarnings}
              onIgnore={skill.localData ? handleIgnoreRule : undefined}
            />
          </div>
        )}

        {/* Local path */}
        {skill.localData?.path && (
          <div>
            <SectionLabel>Local Path</SectionLabel>
            <code className="block p-2 bg-muted rounded text-xs break-all leading-relaxed font-mono">
              {skill.localData.path}
            </code>
          </div>
        )}

        {/* Registry source */}
        {skill.registryData?.sourceUrl && (
          <div>
            <SectionLabel>Source URL</SectionLabel>
            <a
              href={skill.registryData.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline break-all"
            >
              {skill.registryData.sourceUrl}
            </a>
          </div>
        )}

        {/* Error feedback */}
        {actionError && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
            {actionError}
          </div>
        )}

        <div className="pt-4 border-t space-y-2">
          {canInstall && (
            <Button
              className="w-full"
              onClick={handleInstallClick}
              disabled={isBusy}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              {install.isPending ? 'Installing…' : 'Install Skill'}
            </Button>
          )}

          {canUpdate && (
            <Button
              className="w-full"
              onClick={handleUpdateClick}
              disabled={isBusy}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              {diffMutation.isPending ? 'Checking…' : 'Update Skill'}
            </Button>
          )}

          {skill.localData?.path && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => relint.mutate()}
              disabled={isBusy || relint.isPending}
            >
              <RefreshCw
                className={`mr-2 h-3.5 w-3.5 ${relint.isPending ? 'animate-spin' : ''}`}
              />
              {relint.isPending ? 'Linting…' : 'Re-lint'}
            </Button>
          )}

          {isInstalled && skill.localData?.path && (
            <Button
              variant="outline"
              className="w-full"
              disabled={isBusy}
              onClick={handleOpenFolder}
            >
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              Open Folder
            </Button>
          )}

          {isInstalled && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => uninstall.mutate()}
              disabled={isBusy}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              {uninstall.isPending ? 'Uninstalling…' : 'Uninstall'}
            </Button>
          )}

          {(skill.registryData || skill.status !== 'local_only') && (
            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground"
              onClick={() => sync.mutate()}
              disabled={!platformFeaturesEnabled || isBusy}
            >
              <RefreshCw
                className={`mr-1.5 h-3 w-3 ${sync.isPending ? 'animate-spin' : ''}`}
              />
              {sync.isPending ? 'Syncing registry…' : 'Sync registry'}
            </Button>
          )}

          {/* Share button */}
          {skill.localData?.path && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleShareClick}
              disabled={isBusy}
            >
              {loadingContent ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Share2 className="mr-2 h-3.5 w-3.5" />
              )}
              Share as Gist
            </Button>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showInstallDialog && skill.registryData && (
        <InstallDialog
          skill={skill.registryData}
          onClose={() => setShowInstallDialog(false)}
          onConfirm={(target) => {
            setShowInstallDialog(false)
            install.mutate({ target })
          }}
        />
      )}

      {showBlockedAlert && skill.registryData && (
        <BlockedSkillAlert
          skill={skill.registryData}
          onCancel={() => setShowBlockedAlert(false)}
          onInstallAnyway={() => {
            setShowBlockedAlert(false)
            setShowInstallDialog(true)
          }}
        />
      )}

      {showConflictResolver && skill.registryData && (
        <ConflictResolver
          skillName={skill.registryData.name}
          diff={diff}
          onKeepLocal={handleKeepLocal}
          onOverwrite={() => handleOverwrite('personal')}
          onClose={() => setShowConflictResolver(false)}
        />
      )}

      {showShareModal && (
        <ShareSkillModal
          skillName={skill.name}
          contentMd={skillContent}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
      {children}
    </p>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-xs font-medium truncate">{value}</p>
    </div>
  )
}
