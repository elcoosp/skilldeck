import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateBranch } from '@/hooks/use-branches';
import { useUIStore } from '@/store/ui';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useConversationStore } from '@/store/conversation';

interface CreateBranchModalProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  parentMessageId: string;
}

export function CreateBranchModal({ open, onClose, conversationId, parentMessageId }: CreateBranchModalProps) {
  const [name, setName] = useState('');
  const createBranch = useCreateBranch();
  const setActiveBranch = useConversationStore((s) => s.setActiveBranch);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);

  const queryClient = useQueryClient();
  const handleCreate = async () => {
    try {
      const branchId = await createBranch.mutateAsync({
        conversation_id: conversationId,
        parent_message_id: parentMessageId,
        name: name.trim() || null,
      });
      toast.success('Branch created');
      // Invalidate the specific branch query for this conversation
      queryClient.invalidateQueries({ queryKey: ['branches', conversationId] });
      setActiveBranch(branchId);
      setActiveConversation(conversationId);
      onClose();
    } catch (err) {
      toast.error(`Failed to create branch: ${err}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new branch</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="Branch name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-2"
          />
          <p className="text-xs text-muted-foreground">
            This branch will start from the selected message.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createBranch.isPending}>
            {createBranch.isPending ? 'Creating...' : 'Create branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
