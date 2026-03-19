// src/components/skills/lint-warning-panel.tsx
// UX: Displays lint warnings with actionable "Fix" and "Ignore" buttons.
// Security warnings render with red styling, distinct from style/quality warnings.

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  ShieldAlert,
  Wrench,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDisableRule } from '@/hooks/use-lint'
import type { LintWarning } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface LintWarningPanelProps {
  warnings: LintWarning[]
  onApplyFix?: (warning: LintWarning) => void
  onIgnore?: (ruleId: string) => void   // <-- new prop
  className?: string
}

export function LintWarningPanel({
  warnings,
  onApplyFix,
  onIgnore,                            // <-- destructure new prop
  className
}: LintWarningPanelProps) {
  const disableRule = useDisableRule()

  const visible = warnings.filter((w) => w.severity !== 'off')
  if (visible.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground',
          className
        )}
      >
        <CheckCircle2 className="size-4 shrink-0 text-green-500" />
        No lint issues found.
      </div>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {visible.map((w) => (
        <WarningRow
          key={w.rule_id}
          warning={w}
          onFix={onApplyFix ? () => onApplyFix(w) : undefined}
          onIgnore={onIgnore ? () => onIgnore(w.rule_id) : undefined}   // <-- pass down
        />
      ))}
    </div>
  )
}

// ── Single warning row ────────────────────────────────────────────────────────

interface WarningRowProps {
  warning: LintWarning
  onFix?: () => void
  onIgnore?: () => void   // <-- now optional
}

function WarningRow({ warning, onFix, onIgnore }: WarningRowProps) {
  const isSecurity = warning.rule_id.startsWith('sec-')

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        warning.severity === 'error' &&
        isSecurity &&
        'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20',
        warning.severity === 'error' &&
        !isSecurity &&
        'border-destructive/30 bg-destructive/5',
        warning.severity === 'warning' &&
        'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
        warning.severity === 'info' && 'border-border bg-muted/30'
      )}
    >
      {/* Top row: icon + severity + rule code + ignore icon (right-aligned) */}
      <div className="flex items-start gap-2">
        <SeverityIcon severity={warning.severity} isSecure={isSecurity} />
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          <span
            className={cn(
              'font-medium text-xs uppercase tracking-wide',
              warning.severity === 'error' &&
              isSecurity &&
              'text-red-600 dark:text-red-400',
              warning.severity === 'error' && !isSecurity && 'text-destructive',
              warning.severity === 'warning' &&
              'text-amber-600 dark:text-amber-400',
              warning.severity === 'info' && 'text-muted-foreground'
            )}
          >
            {isSecurity ? 'Security' : warning.severity}
          </span>
          <code className="text-[10px] bg-muted/60 px-1 py-0.5 rounded text-muted-foreground font-mono break-all">
            {warning.rule_id}
          </code>
        </div>
        {/* Ignore button – only shown if onIgnore is provided */}
        {onIgnore && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground -mr-1"
                onClick={onIgnore}
              >
                <X className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Disable this rule for the workspace</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Second row: Fix button (if available) - right-aligned */}
      {warning.suggested_fix && onFix && (
        <div className="flex justify-end mt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-2"
            onClick={onFix}
          >
            <Wrench className="size-3 mr-1" />
            Fix
          </Button>
        </div>
      )}

      {/* Message and location */}
      <div className="mt-2 space-y-1">
        <p className="text-sm leading-snug break-words">{warning.message}</p>
        {warning.suggested_fix && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 break-words">
            <Lightbulb className="size-3 shrink-0 mt-0.5 text-amber-500" />
            <span>{warning.suggested_fix}</span>
          </p>
        )}
        {warning.location?.file && (
          <p className="text-[10px] text-muted-foreground font-mono truncate">
            {warning.location.file}
            {warning.location.line != null && `:${warning.location.line}`}
          </p>
        )}
      </div>
    </div>
  )
}

function SeverityIcon({
  severity,
  isSecure
}: {
  severity: LintWarning['severity']
  isSecure: boolean
}) {
  if (severity === 'error' && isSecure)
    return <ShieldAlert className="size-4 text-red-500" />
  if (severity === 'error')
    return <AlertTriangle className="size-4 text-destructive" />
  if (severity === 'warning')
    return <AlertTriangle className="size-4 text-amber-500" />
  return <Info className="size-4 text-muted-foreground" />
}
