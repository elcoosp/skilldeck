// src/components/chat/chat-command-palette.tsx

import { Loader2 } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TrustBadge } from '@/components/skills/trust-badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { UnifiedSkill } from '@/types/skills'

interface ChatCommandPaletteProps {
  type: 'skill'
  query: string
  items: UnifiedSkill[]
  loading: boolean
  position: { top: number; left: number } | null
  onSelect: (skill: UnifiedSkill) => void
  onClose: () => void
}

export const ChatCommandPalette: React.FC<ChatCommandPaletteProps> = ({
  query,
  items,
  loading,
  position,
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = items.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.description.toLowerCase().includes(query.toLowerCase())
  )

  // Reset selection when filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to reset on query change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIndex] as
        | HTMLElement
        | undefined
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Keyboard navigation (global listener while palette is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex])
          onClose()
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, selectedIndex, onSelect, onClose])

  // Click-outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!position) return null

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-50 w-80 bg-popover text-popover-foreground shadow-lg border rounded-lg overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-2 border-b">
        <Input
          placeholder="Search skills…"
          value={query}
          readOnly
          className="h-8 text-sm"
        />
      </div>

      <div className="max-h-60 overflow-y-auto p-1" ref={listRef}>
        {loading && (
          <div className="flex items-center justify-center p-4 gap-2 text-sm text-muted-foreground">
            <Loader2 className="animate-spin w-4 h-4" /> Searching…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No skills found.
          </div>
        )}

        {filtered.map((skill, index) => {
          const isRegistry = !!skill.registryData
          const securityScore = skill.registryData?.securityScore ?? 5
          const qualityScore = skill.registryData?.qualityScore ?? 5
          const sourceType = isRegistry ? 'registry' : 'local'

          return (
            <div
              key={skill.id}
              role="option"
              aria-selected={index === selectedIndex}
              tabIndex={-1}
              className={cn(
                'flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer text-sm',
                index === selectedIndex
                  ? 'bg-primary/20 text-foreground'
                  : 'hover:bg-primary/10'
              )}
              onClick={() => {
                onSelect(skill)
                onClose()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(skill)
                  onClose()
                }
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex flex-col min-w-0 mr-2">
                <span className="font-medium text-blue-600 dark:text-blue-400 truncate flex items-center gap-1">
                  @{skill.name}
                  {sourceType === 'local' && (
                    <span className="ml-1 text-[10px] bg-muted px-1 rounded">
                      local
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground truncate w-48">
                  {skill.description}
                </span>
              </div>
              <div className="flex-shrink-0 ml-2">
                {sourceType === 'registry' ? (
                  <TrustBadge
                    securityScore={securityScore}
                    qualityScore={qualityScore}
                  />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>,
    document.body
  )
}
