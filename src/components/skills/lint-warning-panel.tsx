// src/components/skills/lint-warning-panel.tsx
// UX: Displays lint warnings with actionable "Fix" and "Ignore" buttons.
// Security warnings render with red styling, distinct from style/quality warnings.

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Lightbulb,
  ShieldAlert,
  X
} from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import type { LintWarning } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface LintWarningPanelProps {
  warnings: LintWarning[]
  onApplyFix?: (warning: LintWarning) => void
  onIgnore?: (ruleId: string) => void
  className?: string
  /** Optional root path to strip from displayed file location */
  skillRoot?: string
}

export function LintWarningPanel({
  warnings,
  onApplyFix,
  onIgnore,
  className,
  skillRoot
}: LintWarningPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const visible = warnings.filter((w) => w.severity !== 'off')
  if (visible.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 py-1 text-xs text-muted-foreground',
          className
        )}
      >
        <CheckCircle2 className="size-3.5 text-teal-500 shrink-0" />
        No lint issues
      </div>
    )
  }

  const copyFix = (warning: LintWarning) => {
    if (warning.suggested_fix) {
      navigator.clipboard.writeText(warning.suggested_fix)
      setCopiedId(warning.rule_id)
      toast.success('Fix copied to clipboard')
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {visible.map((w) => (
        <WarningRow
          key={w.rule_id}
          warning={w}
          onFix={onApplyFix ? () => onApplyFix(w) : undefined}
          onIgnore={onIgnore ? () => onIgnore(w.rule_id) : undefined}
          onCopyFix={() => copyFix(w)}
          copied={copiedId === w.rule_id}
          skillRoot={skillRoot}
        />
      ))}
    </div>
  )
}

// ── Single warning row ────────────────────────────────────────────────────────

interface WarningRowProps {
  warning: LintWarning
  onFix?: () => void
  onIgnore?: () => void
  onCopyFix?: () => void
  copied?: boolean
  skillRoot?: string
}

function WarningRow({
  warning,
  onFix,
  onIgnore,
  onCopyFix,
  copied,
  skillRoot
}: WarningRowProps) {
  const isSecurity = warning.rule_id.startsWith('sec-')

  // Strip the skill root prefix if provided
  let displayPath = warning.location?.file ?? ''
  if (skillRoot && displayPath.startsWith(skillRoot)) {
    displayPath = displayPath.slice(skillRoot.length).replace(/^\//, '')
  } else if (!skillRoot) {
    // Fallback: show only last two segments
    const parts = displayPath.split('/')
    if (parts.length > 2) displayPath = parts.slice(-2).join('/')
  }

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-background pl-3 pr-2 py-2.5',
        'border-l-2', // left accent strip
        isSecurity && warning.severity === 'error' && 'border-l-red-500',
        !isSecurity && warning.severity === 'error' && 'border-l-destructive',
        warning.severity === 'warning' && 'border-l-amber-400',
        warning.severity === 'info' && 'border-l-border'
      )}
    >
      {/* Top row: icon + message + action buttons */}
      <div className="flex items-start gap-2">
        <SeverityIcon severity={warning.severity} isSecure={isSecurity} />
        <p className="flex-1 text-xs leading-snug break-words min-w-0">
          {warning.message}
        </p>
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {/* Copy fix button – only if suggested_fix exists */}
          {warning.suggested_fix && onCopyFix && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={onCopyFix}
                >
                  {copied ? (
                    <Check className="size-3.5 text-green-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy fix</TooltipContent>
            </Tooltip>
          )}
          {/* Ignore button */}
          {onIgnore && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={onIgnore}
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Disable this rule</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Sub-row: rule_id + file path */}
      <div className="flex items-center gap-1.5 mt-1 ml-6 min-w-0">
        <code className="text-[10px] text-muted-foreground font-mono shrink-0">
          {warning.rule_id}
        </code>
        {displayPath && (
          <>
            <span className="text-[10px] text-border">·</span>
            <span className="text-[10px] text-muted-foreground font-mono truncate">
              {displayPath}
              {warning.location?.line != null && `:${warning.location.line}`}
            </span>
          </>
        )}
      </div>

      {/* Fix suggestion — inline with Apply button */}
      {warning.suggested_fix && (
        <div className="flex items-start gap-1 mt-1.5 ml-6 min-w-0">
          <Lightbulb className="size-3 shrink-0 mt-0.5 text-amber-500" />
          <p className="text-[11px] text-muted-foreground leading-snug flex-1 min-w-0 break-words">
            {warning.suggested_fix}
          </p>
          {onFix && (
            <button
              type="button"
              onClick={onFix}
              className="shrink-0 text-[10px] text-primary hover:underline ml-1 whitespace-nowrap"
            >
              Apply
            </button>
          )}
        </div>
      )}
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
  const iconClass = 'size-3.5 shrink-0 mt-0.5'
  if (severity === 'error' && isSecure)
    return <ShieldAlert className={cn(iconClass, 'text-red-500')} />
  if (severity === 'error')
    return <AlertTriangle className={cn(iconClass, 'text-destructive')} />
  if (severity === 'warning')
    return <AlertTriangle className={cn(iconClass, 'text-amber-500')} />
  return <Info className={cn(iconClass, 'text-muted-foreground')} />
}
