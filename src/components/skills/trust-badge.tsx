// src/components/skills/trust-badge.tsx
// UX: visually communicates skill safety at a glance.
// Security warnings use red (distinct from style/quality warnings in amber/grey).

import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface TrustBadgeProps {
  securityScore: number
  qualityScore: number
  className?: string
  onClick?: () => void // <-- new prop to scroll to lint panel
}

export function TrustBadge({
  securityScore,
  qualityScore,
  className,
  onClick
}: TrustBadgeProps) {
  let badgeContent: React.ReactNode
  let tooltipText: string

  if (securityScore < 3) {
    badgeContent = (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          className
        )}
      >
        <ShieldAlert className="size-3 shrink-0" />
        Security Risk
      </span>
    )
    tooltipText = `Security score: ${securityScore}/5 – based on ${securityScore === 1 ? 'critical' : 'high'} security warnings.`
  } else if (qualityScore < 3) {
    badgeContent = (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          className
        )}
      >
        <AlertTriangle className="size-3 shrink-0" />
        Low Quality
      </span>
    )
    tooltipText = `Quality score: ${qualityScore}/5 – skill may lack examples, clarity, or structure.`
  } else {
    badgeContent = (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          className
        )}
      >
        <CheckCircle2 className="size-3 shrink-0" />
        Verified Safe
      </span>
    )
    tooltipText = `Security: ${securityScore}/5, Quality: ${qualityScore}/5 – meets baseline standards.`
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn('cursor-pointer', className)}
        >
          {badgeContent}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs max-w-[200px]">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  )
}

/** Compact score dots used inside SkillCard. */
export function ScoreDots({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <fieldset
      className="inline-flex items-center gap-0.5"
      aria-label={`Score ${score} of ${max}`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: static list, index is stable
          key={i}
          className={cn(
            'inline-block size-1.5 rounded-full',
            i < score ? 'bg-primary' : 'bg-muted-foreground/30'
          )}
        />
      ))}
    </fieldset>
  )
}
