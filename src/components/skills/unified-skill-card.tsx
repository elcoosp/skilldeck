// src/components/skills/unified-skill-card.tsx
import { AlertTriangle, ArrowUp } from 'lucide-react' // <-- import ArrowUp
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
  onUpdate?: (skill: UnifiedSkill) => void // <-- new prop
  isSelected?: boolean
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

export function UnifiedSkillCard({
  skill,
  onClick,
  onInstall,
  onUpdate,
  isSelected
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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(skill)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(skill)
        }
      }}
      className={cn(
        'group relative w-full text-left p-4 border rounded-lg cursor-pointer',
        'transition-all duration-150 hover:border-primary/50 hover:shadow-sm',
        'flex flex-col h-full min-h-[140px] focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isSelected
          ? 'ring-2 ring-primary ring-offset-1 ring-offset-background border-border'
          : 'border-border bg-card'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm leading-tight truncate flex-1 min-w-0">
          {skill.name}
        </h3>
        {skill.status === 'update_available' ? (
          <Badge
            variant="destructive"
            className="shrink-0 text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20 flex items-center gap-0.5"
          >
            <ArrowUp className="size-2.5" />
            Update available
          </Badge>
        ) : (
          <Badge
            variant={STATUS_BADGE_VARIANT[skill.status]}
            className={cn(
              'shrink-0 text-[10px] px-1.5 py-0',
              skill.status === 'installed' &&
                'bg-primary/10 text-primary border-primary/20',
              skill.status === 'local_only' &&
                'bg-secondary text-secondary-foreground'
            )}
          >
            {STATUS_LABEL[skill.status]}
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-3 flex-1 leading-relaxed">
        {skill.description || (
          <span className="italic opacity-60">No description</span>
        )}
      </p>

      {/* Footer row */}
      <div className="mt-3 pt-2 border-t border-dashed border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="truncate">
          {hasRegistryData ? skill.registryData?.author : '—'}
        </span>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Lint warning counts */}
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
          {/* Trust badge */}
          <TrustBadge
            securityScore={securityScore}
            qualityScore={qualityScore}
            className="scale-75 origin-right"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-3 right-3 flex gap-1">
        {skill.status === 'available' &&
          platformFeaturesEnabled &&
          onInstall && (
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
      </div>
    </div>
  )
}
