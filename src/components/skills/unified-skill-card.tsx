// src/components/skills/unified-skill-card.tsx
// Presentational card for a single unified skill in the marketplace grid.

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { UnifiedSkill } from '@/types/skills'

interface Props {
  skill: UnifiedSkill
  onClick: (skill: UnifiedSkill) => void
  isSelected?: boolean
}

const STATUS_BORDER: Record<UnifiedSkill['status'], string> = {
  installed: 'border-green-500 bg-green-50 dark:bg-green-950/40',
  local_only: 'border-green-500 bg-green-50 dark:bg-green-950/40',
  available: 'border-border bg-card',
  update_available: 'border-orange-500 bg-orange-50 dark:bg-orange-950/40'
}

const BADGE_VARIANT: Record<
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

export function UnifiedSkillCard({ skill, onClick, isSelected }: Props) {
  return (
    <button
      type="button"
      className={cn(
        'w-full text-left p-4 border-2 rounded-lg cursor-pointer',
        'transition-all duration-150 hover:shadow-md',
        'flex flex-col h-full min-h-[140px] focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        STATUS_BORDER[skill.status],
        isSelected && 'ring-2 ring-primary ring-offset-1'
      )}
      onClick={() => onClick(skill)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm leading-tight truncate flex-1 min-w-0">
          {skill.name}
        </h3>
        <Badge
          variant={BADGE_VARIANT[skill.status]}
          className="shrink-0 text-[10px] px-1.5 py-0"
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
          {skill.registryData?.author ?? (skill.localData ? 'Local' : '—')}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {skill.registryData?.securityScore !== undefined && (
            <span
              className={cn(
                'px-1 py-0.5 rounded font-medium',
                skill.registryData.securityScore >= 80
                  ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                  : skill.registryData.securityScore >= 50
                    ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
                    : 'bg-red-500/15 text-red-700 dark:text-red-400'
              )}
            >
              {skill.registryData.securityScore}
            </span>
          )}
          {skill.registryData?.tags?.[0] && (
            <span className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
              {skill.registryData.tags[0]}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
