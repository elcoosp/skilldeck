import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import ReactDiffViewer from 'react-diff-viewer-continued'
import { ArtifactData } from '@/lib/bindings'
import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface VersionDiffModalProps {
  open: boolean
  onClose: () => void
  versions: ArtifactData[]
}

export function VersionDiffModal({
  open,
  onClose,
  versions
}: VersionDiffModalProps) {
  const [leftVersionId, setLeftVersionId] = useState<string>(
    versions[0]?.id || ''
  )
  const [rightVersionId, setRightVersionId] = useState<string>(
    versions[1]?.id || ''
  )

  const left = versions.find((v) => v.id === leftVersionId)
  const right = versions.find((v) => v.id === rightVersionId)

  if (versions.length === 0) return null

  const isDark = document.documentElement.classList.contains('dark')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* CHANGED: max-w-[95vw] for huge width, h-[90vh] for height, overflow-hidden to prevent outer scroll */}
      <DialogContent
        style={{ maxWidth: '95vw', width: '95vw' }}
        className="max-w-[95vw] h-[90vh] flex flex-col gap-4 overflow-hidden p-0"
      >
        {/* CHANGED: Added padding and shrink-0 so header doesn't collapse */}
        <div className="px-6 pt-6 shrink-0">
          <DialogHeader>
            <DialogTitle>Compare Versions</DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex gap-4 px-6 shrink-0">
          <Select value={leftVersionId} onValueChange={setLeftVersionId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select left version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
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
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name} ({new Date(v.created_at).toLocaleString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* CHANGED: min-h-0 is required for flex-1 to scroll correctly. Added scrollbar-hide. */}
        <div className="flex-1 min-h-0 overflow-auto scrollbar-hide px-6 pb-6">
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
            <p className="text-muted-foreground text-sm">
              Select two versions to compare
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
