// src/components/workspace/file-tree-panel.tsx
import { useQuery } from '@tanstack/react-query'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  Tree,
  File as TreeFile,
  Folder as TreeFolder,
  type TreeViewElement,
} from '@/components/ui/file-tree'
import { commands } from '@/lib/bindings'
import { useSettingsStore } from '@/store/settings'
import { useWorkspaceStore } from '@/store/workspace'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { FileIcon } from '@react-symbols/icons/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flattenTree, getNextVisibleItem, getPrevVisibleItem, findIndexById, type FlattenedNode } from '@/lib/keyboard-tree-navigation'

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  children: FileEntry[]
}

export function FileTreePanel() {
  const { data: workspaces = [] } = useWorkspaces()
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const preferredEditor = useSettingsStore((s) => s.preferredEditor)

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  // Keyboard navigation state
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFileClick = async (filePath: string) => {
    const schemes: Record<string, string> = {
      vscode: 'vscode://file/',
      cursor: 'cursor://file/',
    }
    const url = schemes[preferredEditor]
      ? `${schemes[preferredEditor]}${filePath}`
      : `file://${filePath}`

    await openUrl(url).catch(() => {
      openUrl(`file://${filePath}`)
    })
  }

  const { data: files, isLoading } = useQuery({
    queryKey: ['workspace-files', activeWorkspace?.path],
    queryFn: async () => {
      const res = await commands.listWorkspaceFiles(
        activeWorkspace!.path,
        4,
      )

      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    },
    enabled: !!activeWorkspace?.path,
    staleTime: 30_000,
  })

  const transformFiles = (entries: FileEntry[]): TreeViewElement[] => {
    const sorted = entries.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return sorted.map((entry) => ({
      id: entry.path,
      name: entry.name,
      type: entry.is_dir ? ("folder" as const) : ("file" as const),
      children:
        entry.is_dir && entry.children?.length
          ? transformFiles(entry.children)
          : undefined,
    }))
  }

  const treeElements = files ? transformFiles(files) : []

  // Flatten tree for keyboard navigation
  const flatNodes = useMemo(() => {
    if (!treeElements.length) return []
    return flattenTree(treeElements, expandedIds)
  }, [treeElements, expandedIds])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!flatNodes.length) return

    const currentIndex = focusedId ? findIndexById(flatNodes, focusedId) : -1
    let nextFocused: FlattenedNode | undefined

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        nextFocused = currentIndex === -1 ? flatNodes[0] : getNextVisibleItem(flatNodes, currentIndex)
        break
      case 'ArrowUp':
        e.preventDefault()
        nextFocused = currentIndex === -1 ? flatNodes[flatNodes.length - 1] : getPrevVisibleItem(flatNodes, currentIndex)
        break
      case 'ArrowRight': {
        e.preventDefault()
        const node = flatNodes[currentIndex]
        if (node && node.type === 'folder' && !expandedIds.has(node.id)) {
          toggleExpand(node.id)
          return
        } else if (node && node.type === 'folder' && expandedIds.has(node.id)) {
          nextFocused = getNextVisibleItem(flatNodes, currentIndex)
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        const node = flatNodes[currentIndex]
        if (node && node.type === 'folder' && expandedIds.has(node.id)) {
          toggleExpand(node.id)
          return
        } else if (node && node.parentId) {
          nextFocused = flatNodes.find(n => n.id === node.parentId)
        }
        break
      }
      case 'Enter':
      case ' ': {
        e.preventDefault()
        const node = flatNodes[currentIndex]
        if (node) {
          if (node.type === 'folder') {
            toggleExpand(node.id)
          } else {
            handleFileClick(node.id)
          }
        }
        break
      }
      case 'Home':
        e.preventDefault()
        nextFocused = flatNodes[0]
        break
      case 'End':
        e.preventDefault()
        nextFocused = flatNodes[flatNodes.length - 1]
        break
    }

    if (nextFocused) {
      setFocusedId(nextFocused.id)
      // Scroll into view
      const element = document.querySelector(`[data-tree-item-id="${nextFocused.id}"]`)
      if (element) {
        element.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [flatNodes, focusedId, expandedIds, toggleExpand, handleFileClick])

  // Auto-focus first item when tree loads
  useEffect(() => {
    if (flatNodes.length > 0 && !focusedId) {
      setFocusedId(flatNodes[0].id)
    }
  }, [flatNodes, focusedId])

  const renderTree = (elements: TreeViewElement[]) => {
    return elements.map((element) => {
      if (element.type === "folder") {
        return (
          <TreeFolder
            key={element.id}
            value={element.id}
            element={element.name}
            isFocused={focusedId === element.id}
          >
            {element.children ? renderTree(element.children) : null}
          </TreeFolder>
        )
      }

      return (
        <TreeFile
          key={element.id}
          value={element.id}
          onClick={() => handleFileClick(element.id)}
          className="w-full min-w-0"
          fileIcon={<FileIcon fileName={element.name} width={16} height={16} />}
          isFocused={focusedId === element.id}
        >
          <span className="truncate">{element.name}</span>
        </TreeFile>
      )
    })
  }

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
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="h-full outline-none focus:ring-2 focus:ring-ring rounded-md"
      role="tree"
      aria-label="Workspace files"
      aria-activedescendant={focusedId ?? undefined}
    >
      <Tree
        className="h-full pt-2"
        indicator
        expanded={Array.from(expandedIds)}
        onExpandedChange={(ids) => setExpandedIds(new Set(ids))}
      >
        {treeElements.length > 0 ? (
          renderTree(treeElements)
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No files found in workspace
          </div>
        )}
      </Tree>
    </div>
  )
}
