import { AlertTriangle, Check, Edit2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAchievements } from '@/hooks/use-achievements'
import { commands } from '@/lib/bindings'
import type { ToolCallInfo } from '@/lib/events'
import { cn } from '@/lib/utils'

interface ToolApprovalCardProps {
  toolCallId: string
  toolCall: ToolCallInfo
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
  const { unlock } = useAchievements()

  const resolve = async (approved: boolean) => {
    setResolving(true)
    try {
      let parsed: Record<string, unknown> | null = null
      if (approved && isEditing) {
        try {
          parsed = JSON.parse(editedArgs)
        } catch {
          toast.error('Invalid JSON in edited arguments')
          setResolving(false)
          return
        }
      }
      const jsonValue = parsed as any
      const res = await commands.resolveToolApproval(
        toolCallId,
        approved,
        jsonValue
      )
      if (res.status === 'error') throw new Error(res.error)
      if (approved) {
        unlock('firstToolApproval')
      }
      onResolved()
    } catch (err) {
      toast.error(`Failed to resolve approval: ${err}`)
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="my-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="size-4 text-amber-500 shrink-0" />
        <span className="font-medium text-amber-700 dark:text-amber-400">
          Tool approval required
        </span>
      </div>

      <div className="mb-2">
        <span className="text-xs text-muted-foreground">Tool: </span>
        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
          {toolCall.name}
        </code>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Arguments</span>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setIsEditing((v) => !v)}
            disabled={resolving}
            className="h-6 px-2 text-xs"
          >
            <Edit2 className="size-3 mr-1" />
            {isEditing ? 'Lock' : 'Edit'}
          </Button>
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

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => resolve(true)}
          disabled={resolving}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Check className="size-3.5 mr-1" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => resolve(false)}
          disabled={resolving}
        >
          <X className="size-3.5 mr-1" />
          Deny
        </Button>
      </div>
    </div>
  )
}
