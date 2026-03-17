// src/components/skills/skill-detail-panel.tsx
// Side panel shown when a unified skill card is selected.
// Supports install, uninstall, open-folder and sync actions.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, ExternalLink, RefreshCw, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { commands } from '@/lib/bindings'
import type { UnifiedSkill } from '@/types/skills'

interface Props {
  skill: UnifiedSkill
  onClose: () => void
}

export function SkillDetailPanel({ skill, onClose }: Props) {
  const qc = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)

  const isInstalled =
    skill.status === 'installed' || skill.status === 'local_only'
  const canInstall = !!skill.registryData && !isInstalled
  const canUpdate = skill.status === 'update_available'

  // ── Install ────────────────────────────────────────────────────────────────
  const install = useMutation({
    mutationFn: async () => {
      if (!skill.registryData) throw new Error('No registry data')
      const res = await commands.installSkill(
        skill.registryData.name,
        skill.registryData.content,
        'personal',
        null
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      setActionError(null)
      qc.invalidateQueries({ queryKey: ['local_skills'] })
    },
    onError: (e: Error) => setActionError(e.message)
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
    },
    onError: (e: Error) => setActionError(e.message)
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
    },
    onError: (e: Error) => setActionError(e.message)
  })

  const isBusy = install.isPending || uninstall.isPending || sync.isPending

  return (
    <div className="w-80 xl:w-96 border-l bg-background flex flex-col h-full shadow-lg z-10 shrink-0">
      {/* Header */}
      <div className="p-5 border-b flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-base leading-snug truncate">
            {skill.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
            {skill.status.replace('_', ' ')}
            {skill.registryData?.version && (
              <span className="ml-1.5 opacity-70">
                v{skill.registryData.version}
              </span>
            )}
          </p>
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
            <MetaField
              label="Security"
              value={`${skill.registryData.securityScore}/100`}
            />
            <MetaField
              label="Quality"
              value={`${skill.registryData.qualityScore}/100`}
            />
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
            onClick={() => install.mutate()}
            disabled={isBusy}
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            {install.isPending ? 'Installing…' : 'Install Skill'}
          </Button>
        )}

        {canUpdate && (
          <Button
            className="w-full"
            onClick={() => install.mutate()}
            disabled={isBusy}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            {install.isPending ? 'Updating…' : 'Update Skill'}
          </Button>
        )}

        {isInstalled && skill.localData?.path && (
          <Button
            variant="outline"
            className="w-full"
            disabled={isBusy}
            onClick={async () => {
              // Use the opener plugin to reveal in file manager
              try {
                const { openPath } = await import('@tauri-apps/plugin-opener')
                await openPath(skill.localData!.path!)
              } catch {
                // opener unavailable in dev
              }
            }}
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

        <Button
          variant="ghost"
          className="w-full text-xs text-muted-foreground"
          onClick={() => sync.mutate()}
          disabled={isBusy}
        >
          <RefreshCw
            className={`mr-1.5 h-3 w-3 ${sync.isPending ? 'animate-spin' : ''}`}
          />
          {sync.isPending ? 'Syncing registry…' : 'Sync registry'}
        </Button>
      </div>
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
