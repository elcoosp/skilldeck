// src/components/skills/unified-skill-card.tsx
// Presentational card for a single unified skill in the marketplace grid.
// Aligned with the new card system – neutral borders, consistent hover,
// and status badges using brand colors.

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { UnifiedSkill } from '@/types/skills'
import { TrustBadge } from './trust-badge'
import { useUIStore } from '@/store/ui'

interface Props {
  skill: UnifiedSkill
  onClick: (skill: UnifiedSkill) => void
  onInstall?: (skill: UnifiedSkill) => void
  onUpdate?: (skill: UnifiedSkill) => void
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

export function UnifiedSkillCard({ skill, onClick, onInstall, onUpdate, isSelected }: Props) {
  const platformFeaturesEnabled = useUIStore(s => s.platformFeaturesEnabled)
  const hasRegistryData = !!skill.registryData
  const securityScore = skill.registryData?.securityScore
  const qualityScore = skill.registryData?.qualityScore

  // Compute lint warning counts
  const errorCount = skill.registryData?.lintWarnings?.filter(w => w.severity === 'error').length || 0
  const warningCount = skill.registryData?.lintWarnings?.filter(w => w.severity === 'warning').length || 0

  return (
    <button
      type="button"
      className={cn(
        'group w-full text-left p-4 border rounded-lg cursor-pointer',
        'transition-all duration-150 hover:border-primary/50 hover:shadow-sm',
        'flex flex-col h-full min-h-[140px] focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border bg-card'
      )}
      onClick={() => onClick(skill)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm leading-tight truncate flex-1 min-w-0">
          {skill.name}
        </h3>
        <Badge
          variant={STATUS_BADGE_VARIANT[skill.status]}
          className={cn(
            'shrink-0 text-[10px] px-1.5 py-0',
            skill.status === 'installed' &&
            'bg-primary/10 text-primary border-primary/20',
            skill.status === 'local_only' &&
            'bg-secondary text-secondary-foreground',
            skill.status === 'update_available' &&
            'bg-amber-500/10 text-amber-600 border-amber-500/20'
          )}
        >
          {STATUS_LABEL[skill.status]}
        </Badge>
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
            <span className="text-destructive font-medium" title={`${errorCount} error${errorCount > 1 ? 's' : ''}`}>
              {errorCount} ⚠️
            </span>
          )}
          {warningCount > 0 && errorCount === 0 && (
            <span className="text-amber-500 font-medium" title={`${warningCount} warning${warningCount > 1 ? 's' : ''}`}>
              {warningCount} ⚠️
            </span>
          )}
          {/* Trust badge */}
          {securityScore !== undefined && qualityScore !== undefined && (
            <TrustBadge
              securityScore={securityScore}
              qualityScore={qualityScore}
              className="scale-75 origin-right"
            />
          )}
        </div>
      </div>

      {/* Action buttons */}
      {(skill.status === 'available' || skill.status === 'update_available') && platformFeaturesEnabled && (
        <div className="mt-2 flex justify-end gap-2">
          {skill.status === 'available' && onInstall && (
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
          {skill.status === 'update_available' && onUpdate && (
            <Button
              size="xs"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                onUpdate(skill)
              }}
            >
              Update
            </Button>
          )}
        </div>
      )}
    </button>
  )
}
