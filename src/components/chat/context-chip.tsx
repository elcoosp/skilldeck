// src/components/chat/context-chip.tsx

import { FileIcon, FolderIcon } from '@react-symbols/icons/utils'
import { AlertTriangle, X, Zap } from 'lucide-react'
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

  const type = item.type
  const isAttached = 'data' in item
  const data = isAttached ? item.data : item

  const path = 'path' in data ? data.path : undefined
  const name = data.name || (path ? path.split('/').pop() : '') || 'unknown'
  const id = ('id' in data ? data.id : undefined) || path || data.name || ''

  const lintWarnings =
    isAttached && type === 'skill' && 'lintWarnings' in data
      ? (data.lintWarnings ?? [])
      : []
  const hasWarnings = lintWarnings.length > 0
  const hasError =
    hasWarnings && lintWarnings.some((w) => w.severity === 'error')

  const variant = hasError ? 'destructive' : 'secondary'

  // 根据类型选择图标：技能使用 Zap，文件和文件夹使用 React Symbols
  const icon =
    type === 'skill' ? (
      <Zap className="w-3 h-3" />
    ) : type === 'folder' ? (
      <FolderIcon folderName={name} width={12} height={12} />
    ) : (
      <FileIcon fileName={name} width={12} height={12} />
    )

  const securityScore = 'securityScore' in data ? data.securityScore : undefined
  const qualityScore = 'qualityScore' in data ? data.qualityScore : undefined
  const showTrustBadge =
    isAttached && type === 'skill' && securityScore !== undefined

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

      {showTrustBadge && qualityScore !== undefined && (
        <div className="scale-75 origin-left">
          <TrustBadge
            securityScore={securityScore}
            qualityScore={qualityScore}
          />
        </div>
      )}

      {type === 'folder' && 'scope' in data && (
        <span className="text-[10px] opacity-75">
          ({data.scope === 'deep' ? 'All' : 'Top'})
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
          className="ml-1 rounded-full p-0.5 transition-colors bg-background/20 text-foreground hover:bg-background/50 hover:text-foreground"
          aria-label={`Remove ${name}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {showWarnings && hasWarnings && (
        <div className="absolute bottom-full left-0 mb-1 w-52 bg-popover text-popover-foreground text-xs rounded-lg border p-2 z-20 shadow-lg font-normal">
          <div className="font-bold mb-1 border-b pb-1">Lint Issues:</div>
          <ul className="space-y-1">
            {lintWarnings.map((w, i) => {
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
