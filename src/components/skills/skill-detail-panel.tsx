// src/components/skills/skill-detail-panel.tsx
// Side panel shown when a unified skill card is selected.
// Supports install, uninstall, open-folder, sync, lint warnings, conflict resolution,
// blocked skill alerts, and platform awareness.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LintWarning } from '@/lib/bindings'
import { Download, ExternalLink, RefreshCw, Trash2, X, AlertTriangle } from 'lucide-react'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDisableRule } from '@/hooks/use-skills'  // <-- corrected import
import { commands } from '@/lib/bindings'
import { useUIStore } from '@/store/ui'
import type { UnifiedSkill } from '@/types/skills'
import { BlockedSkillAlert } from './blocked-skill-alert'
import { ConflictResolver } from './conflict-resolver'
import { InstallDialog } from './install-dialog'
import { LintWarningPanel } from './lint-warning-panel'
import { TrustBadge } from './trust-badge'

interface Props {
  skill: UnifiedSkill
  onClose: () => void
}

export function SkillDetailPanel({ skill, onClose }: Props) {
  const qc = useQueryClient()
  const platformFeaturesEnabled = useUIStore((s) => s.platformFeaturesEnabled)
  const lintSectionRef = useRef<HTMLDivElement>(null)

  const [actionError, setActionError] = useState<string | null>(null)
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [showBlockedAlert, setShowBlockedAlert] = useState(false)
  const [showConflictResolver, setShowConflictResolver] = useState(false)
  const [diff, setDiff] = useState('')

  const isInstalled =
    skill.status === 'installed' || skill.status === 'local_only'
  const canInstall =
    !!skill.registryData && !isInstalled && platformFeaturesEnabled
  const canUpdate =
    skill.status === 'update_available' && platformFeaturesEnabled
  const isBlocked = skill.registryData && skill.registryData.securityScore < 2

  // Combine lint warnings from both sources
  const lintWarnings = (
    skill.localData?.lint_warnings ??
    skill.registryData?.lintWarnings ??
    []
  ) as LintWarning[]

  // Determine active source and shadowed source
  const getSourceInfo = () => {
    let activeSource = 'unknown'
    let shadowedSource: string | null = null

    if (skill.status === 'installed' || skill.status === 'update_available') {
      // Local source (workspace or personal)
      if (skill.localData) {
        activeSource = skill.localData.source === 'workspace' ? 'Workspace' : 'Personal'
      }
      // If registry data also exists, local shadows registry
      if (skill.registryData) {
        shadowedSource = 'Registry'
      }
    } else if (skill.status === 'local_only') {
      activeSource = skill.localData?.source === 'workspace' ? 'Workspace' : 'Personal'
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
    lintSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
        onSuccess: () => {
          if (skill.localData?.path) {
            relint.mutate()
          }
        }
      }
    )
  }

  const isBusy =
    install.isPending ||
    uninstall.isPending ||
    sync.isPending ||
    diffMutation.isPending ||
    relint.isPending

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
  const securityScore = skill.localData?.security_score ?? skill.registryData?.securityScore ?? 5
  const qualityScore = skill.localData?.quality_score ?? skill.registryData?.qualityScore ?? 5

  return (
    <div className="w-80 xl:w-96 border-l bg-background flex flex-col h-full shadow-lg z-10 shrink-0">
      {/* Header */}
      <div className="p-5 border-b flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-base leading-snug truncate">
            {skill.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize flex items-center gap-2">
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
          {/* Source info */}
          {activeSource !== 'unknown' && (
            <div className="text-xs mt-1 flex items-center gap-1">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-medium capitalize">{activeSource}</span>
              {shadowedSource && (
                <span className="text-muted-foreground text-[10px]">
                  (shadows {shadowedSource})
                </span>
              )}
            </div>
          )}
          {/* Trust badge with click handler */}
          <div className="mt-2">
            <TrustBadge
              securityScore={securityScore}
              qualityScore={qualityScore}
              onClick={scrollToLint}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 -mr-1 -mt-1 h-7 w-7"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-5 space-y-5 text-sm">
        {/* Description */}
        <div>
          <SectionLabel>Description</SectionLabel>
          <p className="text-sm leading-relaxed text-foreground/90">
            {skill.description || (
              <span className="text-muted-foreground italic">
                No description provided
              </span>
            )}
          </p>
        </div>

        {/* Meta grid */}
        {skill.registryData && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <MetaField
              label="Author"
              value={skill.registryData.author ?? 'Unknown'}
            />
            <MetaField
              label="Version"
              value={skill.registryData.version ?? 'N/A'}
            />
            <MetaField
              label="License"
              value={skill.registryData.license ?? 'Unspecified'}
            />
            <MetaField
              label="Category"
              value={skill.registryData.category ?? 'General'}
            />
          </div>
        )}

        {/* Local scores with tooltips */}
        {skill.localData && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <MetaField label="Security" value={`${skill.localData.security_score}/5`} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Based on security lint warnings. 5 = no errors, 1 = critical errors.</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <MetaField label="Quality" value={`${skill.localData.quality_score}/5`} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Based on style and documentation warnings. 5 = no warnings, 1 = many warnings.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

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
              <a
                href="https://docs.skilldeck.dev/en/latest/guides/skill-linting"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Learn more about linting
              </a>
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
            <SectionLabel>Source</SectionLabel>
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
      </div>

      {/* Actions */}
      <div className="p-5 border-t space-y-2">
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
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${relint.isPending ? 'animate-spin' : ''}`} />
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
