// src/components/workspace/file-tree-panel.tsx
import { useQuery } from '@tanstack/react-query'
import { openUrl, openPath, revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  Tree,
  File as TreeFile,
  Folder as TreeFolder,
  type TreeViewElement,
} from '@/components/ui/file-tree'
import { commands } from '@/lib/bindings'
import { useSettingsStore } from '@/store/settings'
import { useWorkspaceStore } from '@/store/workspace'
import { useConversationStore } from '@/store/conversation'
import { useChatContextStore } from '@/store/chat-context-store'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { useUIPersistentStore } from '@/store/ui-state'
import { FileIcon } from '@react-symbols/icons/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { flattenTree, getNextVisibleItem, getPrevVisibleItem, findIndexById, type FlattenedNode } from '@/lib/keyboard-tree-navigation'
import { filterTree } from '@/lib/filter-tree'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { Search } from 'lucide-react'

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
  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const addFile = useChatContextStore((s) => s.addFile)

  const workspaceExpandedFolders = useUIPersistentStore((s) => s.workspaceExpandedFolders)
  const setWorkspaceExpandedFolders = useUIPersistentStore((s) => s.setWorkspaceExpandedFolders)

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const [searchInput, setSearchInput] = useState('')
  const [searchQuery] = useDebounce(searchInput, 200)

  // Load saved expanded state when workspace changes
  useEffect(() => {
    if (activeWorkspaceId) {
      const saved = workspaceExpandedFolders[activeWorkspaceId] ?? []
      setExpanded(saved)
    }
  }, [activeWorkspaceId, workspaceExpandedFolders])

  // Save expanded state when it changes (via Tree component)
  const handleExpandedChange = useCallback((ids: string[]) => {
    setExpanded(ids)
    if (activeWorkspaceId) {
      setWorkspaceExpandedFolders(activeWorkspaceId, ids)
    }
  }, [activeWorkspaceId, setWorkspaceExpandedFolders])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus()
    }
  }, [])

  const { data: rawGitStatusMap = {} } = useQuery({
    queryKey: ['git-status-list', activeWorkspace?.path],
    queryFn: async () => {
      if (!activeWorkspace?.path) return {}
      const res = await commands.listGitStatus(activeWorkspace.path)
      if (res.status === 'ok') return res.data
      return {}
    },
    enabled: !!activeWorkspace?.path,
    staleTime: 30_000,
  })

  const gitStatusMap = useMemo(() => {
    if (!activeWorkspace?.path || !rawGitStatusMap) return {}
    const result: Record<string, string> = {}
    const base = activeWorkspace.path.replace(/\/$/, '')
    for (const [relPath, status] of Object.entries(rawGitStatusMap)) {
      const absPath = `${base}/${relPath}`.replace(/\/+/g, '/')
      result[absPath] = status
    }
    return result
  }, [activeWorkspace?.path, rawGitStatusMap])

  const handleOpenFile = useCallback(async (filePath: string) => {
    const schemes: Record<string, string> = {
      vscode: 'vscode://file/',
      cursor: 'cursor://file/',
    }

    const editorUrl = schemes[preferredEditor]
      ? `${schemes[preferredEditor]}${filePath}`
      : null

    if (editorUrl) {
      try {
        await openUrl(editorUrl)
        return
      } catch (e) {
        console.warn(`Failed to open with ${preferredEditor}:`, e)
      }
    }

    try {
      await openPath(filePath)
      return
    } catch (e) {
      console.warn('Failed to open with system default:', e)
    }

    try {
      await revealItemInDir(filePath)
      toast.info('Could not open file directly. Revealed in file explorer.')
    } catch {
      toast.error('Could not open or reveal file')
    }
  }, [preferredEditor])

  const handleRevealInFinder = useCallback(async (filePath: string) => {
    try {
      await revealItemInDir(filePath)
    } catch {
      toast.error('Could not reveal in file explorer')
    }
  }, [])

  const handleCopyPath = useCallback(async (filePath: string) => {
    try {
      await navigator.clipboard.writeText(filePath)
      toast.success('Absolute path copied')
    } catch {
      toast.error('Failed to copy path')
    }
  }, [])

  const handleCopyRelativePath = useCallback(async (filePath: string) => {
    try {
      await navigator.clipboard.writeText(filePath)
      toast.success('Relative path copied')
    } catch {
      toast.error('Failed to copy path')
    }
  }, [])

  const handleAttachToConversation = useCallback((filePath: string) => {
    if (!activeConversationId) {
      toast.error('No active conversation')
      return
    }
    const name = filePath.split('/').pop() || filePath
    addFile(activeConversationId, {
      id: filePath,
      name,
      path: filePath,
      size: undefined,
    })
    toast.success(`Attached ${name} to conversation`)
  }, [activeConversationId, addFile])

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

  const transformFiles = useCallback((entries: FileEntry[]): TreeViewElement[] => {
    const sorted = entries.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return sorted.map((entry) => ({
      id: entry.path,
      name: entry.name,
      type: entry.is_dir ? "folder" as const : "file" as const,
      children: entry.is_dir && entry.children?.length ? transformFiles(entry.children) : undefined,
    }))
  }, [])

  const rawTreeElements = useMemo(() => {
    return files ? transformFiles(files) : []
  }, [files, transformFiles])

  const { treeElements, expandedIdsForSearch } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { treeElements: rawTreeElements, expandedIdsForSearch: [] }
    }
    const filtered = filterTree(rawTreeElements, searchQuery)
    const idsToExpand: string[] = []
    const markExpanded = (elements: TreeViewElement[]) => {
      for (const el of elements) {
        if (el.type === 'folder' && el.children && el.children.length > 0) {
          idsToExpand.push(el.id)
          markExpanded(el.children)
        }
      }
    }
    markExpanded(filtered)
    return { treeElements: filtered, expandedIdsForSearch: idsToExpand }
  }, [rawTreeElements, searchQuery])

  useEffect(() => {
    if (searchQuery) {
      setExpanded(expandedIdsForSearch)
    }
  }, [searchQuery, expandedIdsForSearch])

  const expandedSet = useMemo(() => new Set(expanded), [expanded])
  const flatNodes = useMemo(() => {
    if (!treeElements.length) return []
    return flattenTree(treeElements, expandedSet)
  }, [treeElements, expandedSet])

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      if (activeWorkspaceId) {
        setWorkspaceExpandedFolders(activeWorkspaceId, next)
      }
      return next
    })
  }, [activeWorkspaceId, setWorkspaceExpandedFolders])

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
        if (node && node.type === 'folder' && !expanded.includes(node.id)) {
          toggleExpand(node.id)
          return
        } else if (node && node.type === 'folder' && expanded.includes(node.id)) {
          nextFocused = getNextVisibleItem(flatNodes, currentIndex)
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        const node = flatNodes[currentIndex]
        if (node && node.type === 'folder' && expanded.includes(node.id)) {
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
            handleOpenFile(node.id)
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
      default:
        return
    }

    if (nextFocused) {
      setFocusedId(nextFocused.id)
      const element = document.querySelector(`[data-tree-item-id="${nextFocused.id}"]`)
      if (element) {
        element.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [flatNodes, focusedId, expanded, toggleExpand, handleOpenFile])

  useEffect(() => {
    if (flatNodes.length > 0 && !focusedId) {
      setFocusedId(flatNodes[0].id)
    }
  }, [flatNodes, focusedId])

  const renderTree = useCallback((elements: TreeViewElement[]) => {
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
          fileName={element.name}
          onClick={() => handleOpenFile(element.id)}
          className="w-full min-w-0"
          fileIcon={<FileIcon fileName={element.name} width={16} height={16} />}
          isFocused={focusedId === element.id}
        />
      )
    })
  }, [focusedId, handleOpenFile])

  if (!activeWorkspace) {
    return <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">No workspace open</div>
  }

  if (isLoading) {
    return <div className="flex h-full items-center justify-center p-4"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Filter files..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex-1 overflow-auto outline-none"
        role="tree"
        aria-label="Workspace files"
        aria-activedescendant={focusedId ?? undefined}
      >
        <Tree
          className="h-full"
          indicator
          expanded={expanded}
          onExpandedChange={handleExpandedChange}
          gitStatusMap={gitStatusMap}
          onOpenFile={handleOpenFile}
          onRevealInFinder={handleRevealInFinder}
          onCopyPath={handleCopyPath}
          onCopyRelativePath={handleCopyRelativePath}
          onAttachToConversation={handleAttachToConversation}
          workspaceRoot={activeWorkspace?.path}
        >
          {treeElements.length > 0 ? (
            renderTree(treeElements)
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {searchQuery ? 'No matching files' : 'No files found in workspace'}
            </div>
          )}
        </Tree>
      </div>
    </div>
  )
}
