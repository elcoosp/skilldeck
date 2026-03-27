import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ReactDiffViewer from 'react-diff-viewer';
import { ArtifactData } from '@/lib/bindings';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VersionDiffModalProps {
  open: boolean;
  onClose: () => void;
  versions: ArtifactData[];
}

export function VersionDiffModal({ open, onClose, versions }: VersionDiffModalProps) {
  const [leftVersionId, setLeftVersionId] = useState<string>(versions[0]?.id || '');
  const [rightVersionId, setRightVersionId] = useState<string>(versions[1]?.id || '');

  const left = versions.find(v => v.id === leftVersionId);
  const right = versions.find(v => v.id === rightVersionId);

  if (versions.length === 0) return null;

  const isDark = document.documentElement.classList.contains('dark');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 mb-2">
          <Select value={leftVersionId} onValueChange={setLeftVersionId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select left version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} ({new Date(v.created_at).toLocaleString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={rightVersionId} onValueChange={setRightVersionId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select right version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} ({new Date(v.created_at).toLocaleString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-auto">
          {left && right ? (
            <ReactDiffViewer
              oldValue={left.content}
              newValue={right.content}
              splitView
              useDarkTheme={isDark}
              hideLineNumbers={false}
              showDiffOnly={false}
            />
          ) : (
            <p className="text-muted-foreground text-sm">Select two versions to compare</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
