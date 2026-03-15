// src/components/skills/trust-badge.tsx
// UX: visually communicates skill safety at a glance.
// Security warnings use red (distinct from style/quality warnings in amber/grey).

import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrustBadgeProps {
  securityScore: number
  qualityScore: number
  className?: string
}

export function TrustBadge({
  securityScore,
  qualityScore,
  className
}: TrustBadgeProps) {
  if (securityScore < 3) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          className
        )}
        title={`Security score: ${securityScore}/5`}
      >
        <ShieldAlert className="size-3 shrink-0" />
        Security Risk
      </span>
    )
  }

  if (qualityScore < 3) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          className
        )}
        title={`Quality score: ${qualityScore}/5`}
      >
        <AlertTriangle className="size-3 shrink-0" />
        Low Quality
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        className
      )}
      title={`Security: ${securityScore}/5, Quality: ${qualityScore}/5`}
    >
      <CheckCircle2 className="size-3 shrink-0" />
      Verified Safe
    </span>
  )
}

/** Compact score dots used inside SkillCard. */
export function ScoreDots({
  score,
  max = 5
}: {
  score: number
  max?: number
}) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Score ${score} of ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'inline-block size-1.5 rounded-full',
            i < score ? 'bg-primary' : 'bg-muted-foreground/30'
          )}
        />
      ))}
    </span>
  )
}
