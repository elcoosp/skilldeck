// src/components/chat/folder-scope-modal.tsx
import React, { useState, useEffect, useRef } from 'react'
import { File, FolderTree, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FolderScopeModalProps {
  folderPath: string
  shallowCount: number
  deepCount: number
  onConfirm: (isDeep: boolean) => void
  onBack: () => void
}

export const FolderScopeModal: React.FC<FolderScopeModalProps> = ({
  folderPath,
  shallowCount,
  deepCount,
  onConfirm,
  onBack
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const shallowRef = useRef<HTMLButtonElement>(null)
  const deepRef = useRef<HTMLButtonElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev === 0 ? 1 : 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev === 1 ? 0 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex === 0) onConfirm(false)
        else onConfirm(true)
        break
      case 'Escape':
        e.preventDefault()
        onBack()
        break
    }
  }

  useEffect(() => {
    if (selectedIndex === 0) shallowRef.current?.focus()
    else deepRef.current?.focus()
  }, [selectedIndex])

  return (
    <div
      className="p-2 bg-popover rounded-lg border shadow-lg"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b">
        <span className="text-sm font-medium flex items-center gap-1.5 truncate">
          <FolderTree className="w-4 h-4 shrink-0" />
          <span className="truncate">{folderPath || '/'}</span>
        </span>
      </div>

      <div className="space-y-1">
        {/* Shallow option */}
        <Button
          ref={shallowRef}
          variant="ghost"
          className="w-full justify-start gap-3 h-auto py-2 px-2"
          onClick={() => onConfirm(false)}
        >
          <File className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex flex-col items-start text-left">
            <span className="font-medium">Direct children only</span>
            <span className="text-xs text-muted-foreground">
              {shallowCount} file{shallowCount !== 1 ? 's' : ''} in this folder
            </span>
          </div>
        </Button>

        {/* Deep option */}
        <Button
          ref={deepRef}
          variant="ghost"
          className="w-full justify-start gap-3 h-auto py-2 px-2"
          onClick={() => onConfirm(true)}
        >
          <FolderTree className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex flex-col items-start text-left">
            <span className="font-medium">All nested files</span>
            <span className="text-xs text-muted-foreground">
              {deepCount} file{deepCount !== 1 ? 's' : ''} total
            </span>
          </div>
        </Button>
      </div>

      <div className="flex justify-between mt-3 pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
    </div>
  )
}
