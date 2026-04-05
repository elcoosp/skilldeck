import { Loader2 } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { UnifiedSkill } from '@/types/skills'

interface ChatCommandPaletteProps {
  type: 'skill'
  query: string
  items: UnifiedSkill[]
  loading: boolean
  onSelect: (skill: UnifiedSkill) => void
  onClose: () => void
  onQueryChange?: (query: string) => void
}

export const ChatCommandPalette: React.FC<ChatCommandPaletteProps> = ({
  type,
  query,
  items,
  loading,
  onSelect,
  onClose,
  onQueryChange
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Filter items based on query
  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.description?.toLowerCase().includes(query.toLowerCase())
  )

  // Reset index on filter change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as
        | HTMLElement
        | undefined
      selectedEl?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
          onSelect(filtered[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  if (type !== 'skill') return null

  return (
    <div
      ref={pickerRef}
      role="dialog"
      aria-label="Skill picker"
      className="absolute bottom-full left-0 mb-2 z-50 w-full bg-popover text-popover-foreground shadow-lg border rounded-lg overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      <div className="p-2 border-b">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search skills…"
          value={query}
          onChange={(e) => {
            let newVal = e.target.value
            if (newVal.startsWith('@')) newVal = newVal.slice(1)
            onQueryChange?.(newVal)
          }}
          className="h-8 text-sm"
        />
      </div>

      <div className="max-h-60 overflow-y-auto p-1" ref={listRef}>
        {loading && (
          <div className="flex items-center justify-center p-4 gap-2 text-sm text-muted-foreground">
            <Loader2 className="animate-spin w-4 h-4" />
            <span>Loading…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No skills found
          </div>
        )}

        {!loading &&
          filtered.map((skill, index) => (
            <div
              key={skill.id}
              role="option"
              aria-selected={index === selectedIndex}
              tabIndex={-1}
              className={cn(
                'flex flex-col gap-0.5 px-2 py-1.5 rounded-sm cursor-pointer text-sm text-foreground',
                index === selectedIndex
                  ? 'bg-primary/10'
                  : 'hover:bg-primary/10'
              )}
              onClick={() => onSelect(skill)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="font-medium truncate">{skill.name}</span>
              {skill.description && (
                <span className="text-xs text-muted-foreground truncate">
                  {skill.description}
                </span>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
