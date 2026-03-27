import { useQuery } from '@tanstack/react-query';
import { commands, BranchInfo } from '@/lib/bindings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface BranchPickerProps {
  conversationId: string;
  onSelect: (branchId: string) => void;
  disabled?: boolean;
}

export function BranchPicker({ conversationId, onSelect, disabled }: BranchPickerProps) {
  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches', conversationId],
    queryFn: async () => {
      const res = await commands.listBranches(conversationId);
      if (res.status === 'ok') return res.data;
      throw new Error(res.error);
    },
    enabled: !!conversationId,
  });

  if (isLoading) {
    return <Loader2 className="size-4 animate-spin" />;
  }

  if (!branches || branches.length === 0) {
    return <span className="text-xs text-muted-foreground">No branches available</span>;
  }

  return (
    <Select onValueChange={onSelect} disabled={disabled}>
      <SelectTrigger className="h-7 text-xs w-[140px]">
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch: BranchInfo) => (
          <SelectItem key={branch.id} value={branch.id} className="text-xs">
            {branch.name || `Branch ${branch.id.slice(0, 6)}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
