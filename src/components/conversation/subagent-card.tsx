// src/components/conversation/subagent-card.tsx
/**
 * SubagentCard — shown when the orchestrator spawns a subagent to handle
 * a workflow step. Displays real-time status, token usage, and a link to
 * the full subagent conversation thread.
 */

import { Bot, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SubagentStatus = 'running' | 'done' | 'failed'

interface SubagentCardProps {
  stepName: string
  status: SubagentStatus
  /** Tokens consumed so far (updates in real-time while running). */
  tokensUsed?: number
  /** Quality score 0–1 from evaluator-optimizer pattern. */
  qualityScore?: number
  /** Click to open the subagent conversation in center panel. */
  onOpen?: () => void
}

const statusIcon: Record<SubagentStatus, React.ReactNode> = {
  running: <Loader2 className="size-3.5 animate-spin text-primary" />,
  done: <CheckCircle2 className="size-3.5 text-green-500" />,
  failed: <XCircle className="size-3.5 text-destructive" />
}

const statusLabel: Record<SubagentStatus, string> = {
  running: 'Running…',
  done: 'Complete',
  failed: 'Failed'
}

export function SubagentCard({
  stepName,
  status,
  tokensUsed,
  qualityScore,
  onOpen
}: SubagentCardProps) {
  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.()
        }
      }}
      className={cn(
        'my-2 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm',
        onOpen && 'cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all'
      )}
    >
      <Bot className="size-4 shrink-0 text-muted-foreground" />

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-xs">{stepName}</p>
        <p className="text-[11px] text-muted-foreground">
          {statusLabel[status]}
        </p>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
        {tokensUsed !== undefined && (
          <span>{tokensUsed.toLocaleString()} tok</span>
        )}
        {qualityScore !== undefined && (
          <span>Q {(qualityScore * 100).toFixed(0)}%</span>
        )}
        {statusIcon[status]}
      </div>
    </div>
  )
}
