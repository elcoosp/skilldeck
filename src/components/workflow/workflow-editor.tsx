// src/components/workflow/workflow-editor.tsx

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { commands } from '@/lib/bindings'

interface WorkflowEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  id?: string
  initialDefinition?: any
  onSaved?: () => void
}

export function WorkflowEditor({
  open,
  onOpenChange,
  id,
  initialDefinition,
  onSaved
}: WorkflowEditorProps) {
  const [name, setName] = useState(initialDefinition?.name ?? '')
  const [definitionText, setDefinitionText] = useState(
    initialDefinition
      ? JSON.stringify(initialDefinition, null, 2)
      : JSON.stringify(
        {
          name: '',
          pattern: 'sequential',
          steps: [],
          dependencies: []
        },
        null,
        2
      )
  )
  const [error, setError] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsed: any
      try {
        parsed = JSON.parse(definitionText)
      } catch (e) {
        const msg = (e as Error).message
        setError(`Invalid JSON: ${msg}`)
        throw new Error(`Invalid JSON: ${msg}`)
      }
      setError(null)

      if (id) {
        const res = await commands.updateWorkflowDefinition(id, name, parsed)
        if (res.status === 'error') throw new Error(res.error)
        return res.data
      } else {
        const res = await commands.saveWorkflowDefinition({ name, definition: parsed })
        if (res.status === 'error') throw new Error(res.error)
        return res.data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] })
      toast.success(id ? 'Workflow updated' : 'Workflow saved')
      onOpenChange(false)
      onSaved?.()
    },
    onError: (err: Error) => {
      toast.error(`Failed to save workflow: ${err.message}`)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{id ? 'Edit Workflow' : 'New Workflow'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label htmlFor="workflow-name" className="text-sm font-medium">
              Workflow Name
            </label>
            <Input
              id="workflow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workflow"
            />
          </div>
          <div>
            <label
              htmlFor="workflow-definition"
              className="text-sm font-medium"
            >
              Definition (JSON)
            </label>
            <Textarea
              id="workflow-definition"
              value={definitionText}
              onChange={(e) => setDefinitionText(e.target.value)}
              rows={20}
              className="font-mono text-xs"
              placeholder="Paste JSON definition here"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
