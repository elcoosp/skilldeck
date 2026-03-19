// src/components/workspace/workspace-context-badge.tsx
import { HoverCard } from 'radix-ui'
import { Badge } from '@/components/ui/badge'
import type { WorkspaceData } from '@/lib/bindings'

interface WorkspaceContextBadgeProps {
  workspace: WorkspaceData
}

export function WorkspaceContextBadge({
  workspace
}: WorkspaceContextBadgeProps) {
  if (!workspace.is_open) return null

  // Convert string counts to numbers (bindings returns strings for u64)
  const fileCount = Number(workspace.indexed_file_count)
  const contextFilesCount = workspace.context_files.length

  const projectType = workspace.project_type || 'generic'

  return (
    <HoverCard.Root openDelay={200} closeDelay={100}>
      <HoverCard.Trigger asChild>
        <Badge variant="outline" className="ml-2 text-xs cursor-help">
          {projectType} · {fileCount} file{fileCount !== 1 ? 's' : ''}
        </Badge>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="start"
          className="z-50 w-64 p-2 text-xs bg-popover rounded-lg border shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <p className="font-medium mb-1">Loaded context files:</p>
          {workspace.context_files.length > 0 ? (
            <ul className="space-y-0.5 list-disc list-inside">
              {workspace.context_files.map((file) => (
                <li key={file} className="truncate">
                  {file}
                </li>
              ))}
              {fileCount > contextFilesCount && (
                <li className="text-muted-foreground">
                  … and {fileCount - contextFilesCount} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-muted-foreground">No context files loaded</p>
          )}
          <HoverCard.Arrow className="fill-popover" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
