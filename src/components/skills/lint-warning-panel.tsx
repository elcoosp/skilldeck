// src/components/skills/lint-warning-panel.tsx
// UX: Displays lint warnings with actionable "Fix" and "Ignore" buttons.
// Security warnings render with red styling, distinct from style/quality warnings.

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Wrench,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDisableRule } from '@/hooks/use-lint'
import type { LintWarning } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface LintWarningPanelProps {
  warnings: LintWarning[]
  onApplyFix?: (warning: LintWarning) => void
  className?: string
}

export function LintWarningPanel({
  warnings,
  onApplyFix,
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
      {visible.map((w, idx) => (
        <WarningRow
          key={`${w.rule_id}-${idx}`}
          warning={w}
          onFix={onApplyFix ? () => onApplyFix(w) : undefined}
          onIgnore={() =>
            disableRule.mutate({ ruleId: w.rule_id, scope: 'workspace' })
          }
        />
      ))}
    </div>
  )
}

// ── Single warning row ────────────────────────────────────────────────────────

interface WarningRowProps {
  warning: LintWarning
  onFix?: () => void
  onIgnore: () => void
}

function WarningRow({ warning, onFix, onIgnore }: WarningRowProps) {
  const isSecurity = warning.rule_id.startsWith('sec-')

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-sm',
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
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        <SeverityIcon severity={warning.severity} isSecure={isSecurity} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
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
          <code className="text-[10px] bg-muted/60 px-1 py-0.5 rounded text-muted-foreground font-mono">
            {warning.rule_id}
          </code>
        </div>
        <p className="mt-0.5 text-sm leading-snug">{warning.message}</p>
        {warning.suggested_fix && (
          <p className="mt-1 text-xs text-muted-foreground">
            💡 {warning.suggested_fix}
          </p>
        )}
        {warning.location?.file && (
          <p className="mt-0.5 text-[10px] text-muted-foreground font-mono truncate">
            {warning.location.file}
            {warning.location.line != null && `:${warning.location.line}`}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {warning.suggested_fix && onFix && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-2"
            onClick={onFix}
          >
            <Wrench className="size-3 mr-1" />
            Fix
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
          onClick={onIgnore}
          title="Disable this rule for the workspace"
        >
          <X className="size-3 mr-1" />
          Ignore
        </Button>
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
