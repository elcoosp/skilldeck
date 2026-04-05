// src/components/workspace/file-tree-panel.tsx
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import { useState, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/workspace'
import { useSettingsStore } from '@/store/settings'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  children: FileEntry[]
}

interface FileTreeItemProps {
  entry: FileEntry
  depth?: number
}

function FileTreeItem({ entry, depth = 0 }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 1)
  const preferredEditor = useSettingsStore((s) => s.preferredEditor)

  const handleClick = async () => {
    if (entry.is_dir) {
      setExpanded(!expanded)
    } else {
      const schemes: Record<string, string> = {
        vscode: 'vscode://file/',
        cursor: 'cursor://file/',
      }
      const url = schemes[preferredEditor]
        ? `${schemes[preferredEditor]}${entry.path}`
        : `file://${entry.path}`
      await openUrl(url).catch(() => {
        // Fallback: just open with system default
        openUrl(`file://${entry.path}`)
      })
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-accent transition-colors"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {entry.is_dir ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )
        ) : (
          <span className="w-3" />
        )}
        {entry.is_dir ? (
          <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <File className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{entry.name}</span>
      </button>
      {entry.is_dir && expanded && entry.children.map((child) => (
        <FileTreeItem key={child.path} entry={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function FileTreePanel() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  const { data: files, isLoading } = useQuery({
    queryKey: ['workspace-files', activeWorkspace?.path],
    queryFn: () => invoke<FileEntry[]>('list_workspace_files', {
      workspacePath: activeWorkspace!.path,
      maxDepth: 4,
    }),
    enabled: !!activeWorkspace?.path,
    staleTime: 30_000,
  })

  if (!activeWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        No workspace open
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        {files && files.length > 0 ? (
          files.map((entry) => (
            <FileTreeItem key={entry.path} entry={entry} />
          ))
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No files found in workspace
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
