import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from '@/components/ui/toast'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  useDeleteWorkflowDefinition,
  useWorkflowDefinitions
} from '@/hooks/use-workflow-definitions'
import { WorkflowEditor } from '@/components/workflow/workflow-editor'

export const Route = createFileRoute('/_app/settings/workflows')({
  component: WorkflowsSettings
})

function WorkflowsSettings() {
  const { data: workflows = [], isLoading } = useWorkflowDefinitions()
  const deleteMutation = useDeleteWorkflowDefinition()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<any>(null)

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete "${name}"?`)) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Workflow deleted'),
        onError: (err) => toast.error(`Failed: ${err}`)
      })
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Workflows</h2>
        <Button size="sm" onClick={() => { setEditingWorkflow(null); setEditorOpen(true) }}>
          <Plus className="size-4 mr-1" />
          New Workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : workflows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No saved workflows. Create one to get started.
        </p>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{wf.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(wf.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => { setEditingWorkflow(wf.definition); setEditorOpen(true) }}
                    title="Edit workflow"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(wf.id, wf.name)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete workflow"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <WorkflowEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialDefinition={editingWorkflow}
        onSaved={() => setEditorOpen(false)}
      />
    </div>
  )
}
