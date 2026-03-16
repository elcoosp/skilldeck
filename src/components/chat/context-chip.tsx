// src/components/chat/context-chip.tsx
import React, { useState } from 'react'
import type { AttachedItem } from '@/types/chat-context'
import { TrustBadge } from '@/components/skills/trust-badge'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { X, File, Folder, Zap, AlertTriangle } from 'lucide-react'

interface ContextChipProps {
  item: AttachedItem
  onRemove: (id: string) => void
}

export const ContextChip: React.FC<ContextChipProps> = ({ item, onRemove }) => {
  const [showWarnings, setShowWarnings] = useState(false)
  const isSkill = item.type === 'skill'
  const isFolder = item.type === 'folder'

  const lintWarnings = isSkill ? (item.data as any).lintWarnings ?? [] : []
  const hasWarnings = lintWarnings.length > 0
  const hasError = hasWarnings && lintWarnings.some((w: any) => w.severity === 'error')

  const variant = hasError ? 'destructive' : 'secondary'
  const icon = isSkill ? (
    <Zap className="w-3 h-3" />
  ) : isFolder ? (
    <Folder className="w-3 h-3" />
  ) : (
    <File className="w-3 h-3" />
  )

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
      {icon}
      <span className="max-w-[80px] truncate">{item.data.name}</span>

      {isSkill && (
        <div className="scale-75 origin-left">
          <TrustBadge
            securityScore={(item.data as any).securityScore}
            qualityScore={(item.data as any).qualityScore}
          />
        </div>
      )}

      {isFolder && (
        <span className="text-[10px] opacity-75">
          ({(item.data as any).scope === 'deep' ? 'All' : 'Top'})
        </span>
      )}

      {hasWarnings && (
        <span
          className="cursor-pointer"
          onMouseEnter={() => setShowWarnings(true)}
          onMouseLeave={() => setShowWarnings(false)}
        >
          <AlertTriangle className="w-3 h-3 text-yellow-600" />
        </span>
      )}

      <button
        onClick={() => onRemove(item.data.id)}
        className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Remove ${item.data.name}`}
      >
        <X className="w-3 h-3" />
      </button>

      {/* Lint warnings tooltip */}
      {showWarnings && hasWarnings && (
        <div className="absolute bottom-full left-0 mb-1 w-52 bg-popover text-popover-foreground text-xs rounded-lg border p-2 z-20 shadow-lg font-normal">
          <div className="font-bold mb-1 border-b pb-1">Lint Issues:</div>
          <ul className="space-y-1">
            {lintWarnings.map((w: any, i: number) => (
              <li
                key={i}
                className={cn(
                  'flex items-start gap-1',
                  w.severity === 'error' ? 'text-destructive' : 'text-yellow-600 dark:text-yellow-400'
                )}
              >
                <span className="capitalize font-bold">{w.severity}:</span>
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Badge>
  )
}
