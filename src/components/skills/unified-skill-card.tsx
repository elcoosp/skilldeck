// src/components/skills/unified-skill-card.tsx
import { AlertTriangle, ArrowUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { LintWarning } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useUIPersistentStore } from '@/store/ui-state'
import type { UnifiedSkill } from '@/types/skills'
import { TrustBadge } from './trust-badge'

interface Props {
  skill: UnifiedSkill
  onClick: (skill: UnifiedSkill) => void
  onInstall?: (skill: UnifiedSkill) => void
  onUpdate?: (skill: UnifiedSkill) => void
  isSelected?: boolean
  variant?: 'grid' | 'list'
}

const STATUS_BADGE_VARIANT: Record<
  UnifiedSkill['status'],
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  installed: 'default',
  local_only: 'secondary',
  available: 'outline',
  update_available: 'destructive'
}

const STATUS_LABEL: Record<UnifiedSkill['status'], string> = {
  installed: 'Installed',
  local_only: 'Local',
  available: 'Available',
  update_available: 'Update'
}

// Status to left border color mapping for list variant
const STATUS_BORDER_COLOR: Record<UnifiedSkill['status'], string> = {
  installed: 'bg-teal-500',
  local_only: 'bg-blue-500',
  available: 'bg-amber-500',
  update_available: 'bg-destructive'
}

export function UnifiedSkillCard({
  skill,
  onClick,
  onInstall,
  onUpdate,
  isSelected,
  variant = 'grid'
}: Props) {
  const platformFeaturesEnabled = useUIPersistentStore(
    (s) => s.platformFeaturesEnabled
  )
  const hasRegistryData = !!skill.registryData

  // Use local data if available, fallback to registry data
  const securityScore =
    skill.localData?.security_score ?? skill.registryData?.securityScore ?? 5
  const qualityScore =
    skill.localData?.quality_score ?? skill.registryData?.qualityScore ?? 5

  // Combine lint warnings from both sources
  const lintWarnings = (skill.localData?.lint_warnings ??
    skill.registryData?.lintWarnings ??
    []) as LintWarning[]
  const errorCount = lintWarnings.filter((w) => w.severity === 'error').length
  const warningCount = lintWarnings.filter(
    (w) => w.severity === 'warning'
  ).length

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(skill)
    }
  }

  const isList = variant === 'list'

  const actionButtons = (
    <>
      {skill.status === 'available' && platformFeaturesEnabled && onInstall && (
        <Button
          size="xs"
          onClick={(e) => {
            e.stopPropagation()
            onInstall(skill)
          }}
        >
          Install
        </Button>
      )}
      {skill.status === 'update_available' &&
        platformFeaturesEnabled &&
        onUpdate && (
          <Button
            size="xs"
            variant="outline"
            className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
            onClick={(e) => {
              e.stopPropagation()
              onUpdate(skill)
            }}
          >
            <ArrowUp className="size-3 mr-1" />
            Update
          </Button>
        )}
    </>
  )

  // ──────────────────────────────────────────────────────────────────────────
  // LIST VARIANT (1 column) – compact horizontal layout with left accent
  // ──────────────────────────────────────────────────────────────────────────
  if (isList) {
    const borderColor = STATUS_BORDER_COLOR[skill.status]
    return (
      // biome-ignore lint/a11y/useSemanticElements: ok
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick(skill)}
        onKeyDown={handleKeyDown}
        className={cn(
          'group relative w-full text-left rounded-lg cursor-pointer',
          'transition-colors duration-200',
          'hover:bg-muted/50',
          'flex items-stretch overflow-hidden',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          isSelected && 'bg-muted'
        )}
      >
        {/* Left status accent bar */}
        <div className={cn('w-1 shrink-0 rounded-l-lg', borderColor)} />

        <div className="flex-1 min-w-0 flex items-center gap-2 py-2 px-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{skill.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {skill.description || '—'}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {actionButtons}
          </div>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GRID VARIANT (2 columns) – footer with inline actions and flex-wrap
  // ──────────────────────────────────────────────────────────────────────────
  return (
    // biome-ignore lint/a11y/useSemanticElements: ok
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(skill)}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative w-full text-left p-3 border rounded-lg cursor-pointer',
        'transition-colors duration-200',
        'hover:border-primary/40',
        'flex flex-col h-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isSelected
          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background border-border'
          : 'border-border bg-card'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm leading-tight truncate flex-1 min-w-0">
          {skill.name}
        </h3>
        {skill.status === 'update_available' ? (
          <Badge
            variant="destructive"
            className="shrink-0 text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20 flex items-center gap-0.5"
          >
            <ArrowUp className="size-2.5" />
            Update
          </Badge>
        ) : (
          <Badge
            variant={STATUS_BADGE_VARIANT[skill.status]}
            className={cn(
              'shrink-0 text-[10px] px-1.5 py-0 rounded-full',
              skill.status === 'installed' &&
              'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400',
              skill.status === 'local_only' &&
              'bg-secondary text-secondary-foreground',
              skill.status === 'available' &&
              'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400'
            )}
          >
            {STATUS_LABEL[skill.status]}
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1 flex-1">
        {skill.description || (
          <span className="italic opacity-60">No description</span>
        )}
      </p>

      {/* Footer row with author, lint, trust badge, and action buttons */}
      <div className="mt-3 pt-2 border-t border-dashed border-border/60 flex items-center justify-between gap-1 flex-wrap">
        <span className="text-[10px] text-muted-foreground truncate">
          {hasRegistryData ? skill.registryData?.author : '—'}
        </span>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span
              className="text-destructive font-medium inline-flex items-center gap-0.5"
              title={`${errorCount} error${errorCount > 1 ? 's' : ''}`}
            >
              {errorCount} <AlertTriangle className="size-3" />
            </span>
          )}
          {warningCount > 0 && errorCount === 0 && (
            <span
              className="text-amber-500 font-medium inline-flex items-center gap-0.5"
              title={`${warningCount} warning${warningCount > 1 ? 's' : ''}`}
            >
              {warningCount} <AlertTriangle className="size-3" />
            </span>
          )}
          <TrustBadge
            securityScore={securityScore}
            qualityScore={qualityScore}
            className="scale-75 origin-right"
          />
          {actionButtons}
        </div>
      </div>
    </div>
  )
}
