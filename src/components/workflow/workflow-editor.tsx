import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { commands } from '@/lib/bindings';

interface WorkflowEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDefinition?: any;
  onSaved?: () => void;
}

export function WorkflowEditor({ open, onOpenChange, initialDefinition, onSaved }: WorkflowEditorProps) {
  const [name, setName] = useState('');
  const [definitionText, setDefinitionText] = useState(
    initialDefinition
      ? JSON.stringify(initialDefinition, null, 2)
      : JSON.stringify(
        {
          name: '',
          pattern: 'sequential',
          steps: [],
          dependencies: [],
        },
        null,
        2
      )
  );
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsed;
      try {
        parsed = JSON.parse(definitionText);
      } catch (e) {
        throw new Error('Invalid JSON: ' + (e as Error).message);
      }
      const res = await commands.saveWorkflowDefinition({ name, definition: parsed });
      if (res.status === 'error') throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] });
      toast.success('Workflow saved');
      onOpenChange(false);
      onSaved?.();
    },
    onError: (err: Error) => {
      toast.error('Failed to save workflow: ' + err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Workflow Definition</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Workflow Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workflow"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Definition (JSON)</label>
            <Textarea
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
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
