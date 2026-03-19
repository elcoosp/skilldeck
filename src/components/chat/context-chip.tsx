// src/components/chat/context-chip.tsx

import { AlertTriangle, File, Folder, X, Zap } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { TrustBadge } from '@/components/skills/trust-badge'
import { Badge } from '@/components/ui/badge'
import type { ContextItem } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import type { AttachedItem } from '@/types/chat-context'

type ChipItem = AttachedItem | ContextItem

interface ContextChipProps {
  item: ChipItem
  onRemove?: (id: string) => void
  isLoading?: boolean
  _isError?: boolean // unused, kept for API compatibility
  readonly?: boolean
}

export const ContextChip: React.FC<ContextChipProps> = ({
  item,
  onRemove,
  isLoading,
  _isError,
  readonly = false
}) => {
  const [showWarnings, setShowWarnings] = useState(false)

  const isAttached = 'data' in item
  const type = isAttached
    ? (item as AttachedItem).type
    : (item as ContextItem).type
  const data = isAttached ? (item as AttachedItem).data : item

  const getString = (field: string): string | undefined => {
    const val = (data as any)[field]
    return typeof val === 'string' ? val : undefined
  }

  const name =
    getString('name') ||
    (getString('path') ? getString('path')!.split('/').pop() : '') ||
    'unknown'
  const id = getString('id') || getString('path') || getString('name') || ''

  const lintWarnings =
    isAttached && type === 'skill' ? ((data as any).lintWarnings ?? []) : []
  const hasWarnings = lintWarnings.length > 0
  const hasError =
    hasWarnings && lintWarnings.some((w: any) => w.severity === 'error')

  const variant = hasError ? 'destructive' : 'secondary'
  const icon =
    type === 'skill' ? (
      <Zap className="w-3 h-3" />
    ) : type === 'folder' ? (
      <Folder className="w-3 h-3" />
    ) : (
      <File className="w-3 h-3" />
    )

  const showTrustBadge =
    isAttached && type === 'skill' && (data as any).securityScore !== undefined

  return (
    <Badge
      data-testid="context-chip"
      variant={variant}
      className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium group relative transition-all cursor-default',
        hasWarnings &&
          !hasError &&
          'bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      )}
    >
      {isLoading ? (
        <span className="inline-block w-3 h-3 border-2 border-t-transparent border-current rounded-full animate-spin" />
      ) : (
        icon
      )}
      <span className="max-w-[80px] truncate">{name}</span>

      {showTrustBadge && (
        <div className="scale-75 origin-left">
          <TrustBadge
            securityScore={(data as any).securityScore}
            qualityScore={(data as any).qualityScore}
          />
        </div>
      )}

      {type === 'folder' && (data as any).scope && (
        <span className="text-[10px] opacity-75">
          ({(data as any).scope === 'deep' ? 'All' : 'Top'})
        </span>
      )}

      {hasWarnings && (
        <button
          type="button"
          className="cursor-pointer bg-transparent border-0 p-0"
          onClick={() => setShowWarnings(!showWarnings)}
          onMouseEnter={() => setShowWarnings(true)}
          onMouseLeave={() => setShowWarnings(false)}
          aria-label="Show lint warnings"
        >
          <AlertTriangle className="w-3 h-3 text-yellow-600" />
        </button>
      )}

      {!readonly && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(id)}
          className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Remove ${name}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {showWarnings && hasWarnings && (
        <div className="absolute bottom-full left-0 mb-1 w-52 bg-popover text-popover-foreground text-xs rounded-lg border p-2 z-20 shadow-lg font-normal">
          <div className="font-bold mb-1 border-b pb-1">Lint Issues:</div>
          <ul className="space-y-1">
            {lintWarnings.map((w: any, i: number) => {
              const key = `${w.rule_id ?? 'warning'}-${i}`
              return (
                <li
                  key={key}
                  className={cn(
                    'flex items-start gap-1',
                    w.severity === 'error'
                      ? 'text-destructive'
                      : 'text-yellow-600 dark:text-yellow-400'
                  )}
                >
                  <span className="capitalize font-bold">{w.severity}:</span>
                  <span>{w.message}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Badge>
  )
}
