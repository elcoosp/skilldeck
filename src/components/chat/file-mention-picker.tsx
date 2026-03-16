// src/components/chat/file-mention-picker.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronLeft,
  FileIcon,
  FolderIcon,
  CheckCircle,
  Loader2,
  XCircle
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FolderScopeModal } from './folder-scope-modal'
import type { FileEntry, FolderCounts } from '@/types/chat-context'
import { cn } from '@/lib/utils'

interface FileMentionPickerProps {
  open: boolean
  query: string
  position: { top: number; left: number } | null
  items: FileEntry[]
  loading: boolean
  uploadingFiles?: Map<string, { status: 'pending' | 'success' | 'error'; error?: string }>
  currentFolderCounts?: FolderCounts
  onSelect: (file: FileEntry, isDeep?: boolean) => void
  onClose: () => void
  onQueryChange?: (query: string) => void
}

const FILE_SIZE_WARN_THRESHOLD = 50 * 1024 // 50 KB

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const FileMentionPicker: React.FC<FileMentionPickerProps> = ({
  open,
  query,
  position,
  items,
  loading,
  uploadingFiles = new Map(),
  currentFolderCounts = { shallow: 0, deep: 0 },
  onSelect,
  onClose,
  onQueryChange
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [view, setView] = useState<'list' | 'folder-scope-confirm'>('list')
  const [pendingFolder, setPendingFolder] = useState<FileEntry | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Filter by query
  const filtered = items.filter(
    (f) =>
      f.name.toLowerCase().includes(query.toLowerCase()) ||
      f.path.toLowerCase().includes(query.toLowerCase())
  )

  // Reset view when picker closes
  useEffect(() => {
    if (!open) {
      setView('list')
      setPendingFolder(null)
      setSelectedIndex(0)
    }
  }, [open])

  // Focus search input when list is shown
  useEffect(() => {
    if (open && view === 'list' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open, view])

  // Scroll selected item into view
  useEffect(() => {
    if (view === 'list' && listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement | undefined
      selectedEl?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, view])

  // Click-outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onClose])

  const handleItemSelect = useCallback(
    (file: FileEntry, isDeep?: boolean) => {
      // "." = current folder → show scope confirmation
      if (file.is_dir && file.name === '.') {
        setPendingFolder(file)
        setView('folder-scope-confirm')
        return
      }
      onSelect(file, isDeep)
    },
    [onSelect]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return

    if (view === 'folder-scope-confirm') {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setView('list')
        setPendingFolder(null)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        e.stopPropagation()
        if (filtered[selectedIndex]) {
          handleItemSelect(filtered[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  const renderStatusIcon = (file: FileEntry) => {
    const status = uploadingFiles.get(file.name)
    if (!status) return null
    switch (status.status) {
      case 'pending':
        return <Loader2 className="animate-spin w-3 h-3" />
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />
    }
  }

  if (!open || !position) return null

  return createPortal(
    <div
      ref={pickerRef}
      className="fixed z-50 w-80 bg-popover text-popover-foreground shadow-lg border rounded-lg overflow-hidden"
      style={{ top: position.top, left: position.left }}
      onKeyDown={handleKeyDown}
    >
      <div className="p-2 border-b">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search files…"
          value={query}
          onChange={(e) => {
            let newVal = e.target.value
            if (newVal.startsWith('#')) newVal = newVal.slice(1)
            onQueryChange?.(newVal)
          }}
          className="h-8 text-sm"
        />
      </div>

      {view === 'folder-scope-confirm' && pendingFolder && (
        <FolderScopeModal
          folderPath={pendingFolder.path}
          shallowCount={currentFolderCounts.shallow}
          deepCount={currentFolderCounts.deep}
          onConfirm={(isDeep) => {
            onSelect(pendingFolder, isDeep)
            setView('list')
            setPendingFolder(null)
          }}
          onBack={() => {
            setView('list')
            setPendingFolder(null)
          }}
        />
      )}

      {view === 'list' && (
        <div className="max-h-60 overflow-y-auto p-1" ref={listRef}>
          {loading && (
            <div className="flex items-center justify-center p-4 gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin w-4 h-4" />
              <span>Loading…</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No files found
            </div>
          )}

          {!loading &&
            filtered.map((file, index) => {
              const sizeFormatted = file.is_dir ? '—' : formatBytes(file.size)
              const isLarge = !file.is_dir && (file.size ?? 0) > FILE_SIZE_WARN_THRESHOLD
              return (
                <div
                  key={file.path}
                  role="option"
                  aria-selected={index === selectedIndex}
                  tabIndex={-1}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer text-sm',
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  )}
                  onClick={() => handleItemSelect(file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="w-4 h-4 flex items-center justify-center text-muted-foreground shrink-0">
                    {file.is_dir ? (
                      file.name === '..' ? (
                        <ChevronLeft className="w-4 h-4" />
                      ) : (
                        <FolderIcon className="w-4 h-4" />
                      )
                    ) : (
                      <FileIcon className="w-4 h-4" />
                    )}
                  </span>
                  <span className="font-medium truncate w-24">{file.name}</span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">
                    {file.path}
                  </span>
                  <span
                    className={cn(
                      'text-xs tabular-nums shrink-0',
                      isLarge && 'text-yellow-600 dark:text-yellow-500'
                    )}
                  >
                    {sizeFormatted}
                  </span>
                  <span className="w-3 h-3 shrink-0">{renderStatusIcon(file)}</span>
                </div>
              )
            })}
        </div>
      )}
    </div>,
    document.body
  )
}
