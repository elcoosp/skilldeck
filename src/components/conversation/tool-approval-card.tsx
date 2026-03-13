/**
 * ToolApprovalCard — displayed inline when the agent requests a tool call
 * that requires explicit user approval (ASR-SEC-002).
 *
 * Resolves the Rust oneshot channel via `resolve_tool_approval` IPC command.
 */

import { useState } from 'react'
import { AlertTriangle, Check, Edit2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { resolveToolApproval } from '@/lib/invoke'
import type { ToolCallInfo } from '@/lib/events'

interface ToolApprovalCardProps {
  toolCallId: string
  toolCall: ToolCallInfo
  /** Called once the gate is resolved so the parent can unmount the card. */
  onResolved: () => void
}

export function ToolApprovalCard({
  toolCallId,
  toolCall,
  onResolved
}: ToolApprovalCardProps) {
  const [editedArgs, setEditedArgs] = useState(
    JSON.stringify(toolCall.arguments, null, 2)
  )
  const [isEditing, setIsEditing] = useState(false)
  const [resolving, setResolving] = useState(false)

  const resolve = async (approved: boolean) => {
    setResolving(true)
    try {
      let parsed: Record<string, unknown> | undefined
      if (approved && isEditing) {
        try {
          parsed = JSON.parse(editedArgs)
        } catch {
          toast.error('Invalid JSON in edited arguments')
          setResolving(false)
          return
        }
      }
      await resolveToolApproval(toolCallId, approved, parsed)
      onResolved()
    } catch (err) {
      toast.error(`Failed to resolve approval: ${err}`)
      setResolving(false)
    }
  }

  return (
    <div className="my-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="size-4 text-amber-500 shrink-0" />
        <span className="font-medium text-amber-700 dark:text-amber-400">
          Tool approval required
        </span>
      </div>

      {/* Tool name */}
      <div className="mb-2">
        <span className="text-xs text-muted-foreground">Tool: </span>
        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
          {toolCall.name}
        </code>
      </div>

      {/* Arguments */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Arguments</span>
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            disabled={resolving}
          >
            <Edit2 className="size-3" />
            {isEditing ? 'Lock' : 'Edit'}
          </button>
        </div>

        {isEditing ? (
          <textarea
            value={editedArgs}
            onChange={(e) => setEditedArgs(e.target.value)}
            className={cn(
              'w-full font-mono text-xs rounded border border-input bg-background p-2',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              'resize-none min-h-[80px]'
            )}
            disabled={resolving}
          />
        ) : (
          <pre className="text-xs font-mono bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(toolCall.arguments, null, 2)}
          </pre>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => resolve(true)}
          disabled={resolving}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
          )}
        >
          <Check className="size-3.5" />
          Approve
        </button>
        <button
          onClick={() => resolve(false)}
          disabled={resolving}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            'bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-50'
          )}
        >
          <X className="size-3.5" />
          Deny
        </button>
      </div>
    </div>
  )
}
