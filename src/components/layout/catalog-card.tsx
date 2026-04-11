// src/components/layout/catalog-card.tsx

import { useEffect, useRef, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { ExternalLink, Loader2, Package, Plus } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { CatalogEntry } from './mcp-tab'

interface CatalogCardProps {
  entry: CatalogEntry
  alreadyAdded: boolean
  adding: boolean
  onAdd: (entry: CatalogEntry) => void
}

export function CatalogCard({
  entry,
  alreadyAdded,
  adding,
  onAdd
}: CatalogCardProps) {
  const measureRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const measure = measureRef.current
    const parent = measure?.parentElement
    if (!measure || !parent) return

    const check = () => {
      const fullWidth = measure.scrollWidth
      const availableWidth = parent.clientWidth

      // If we need to show "+x", account for its width (~30px)
      const requiredWidth = entry.tags.length > 1 ? fullWidth + 30 : fullWidth

      setCollapsed(requiredWidth > availableWidth)
    }

    check()
    const observer = new ResizeObserver(check)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [entry.tags])

  const handleDocsClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await openUrl(entry.docsUrl)
    } catch (e) {
      toast.error(`Failed to open link: ${e}`)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1 px-2.5 py-2 rounded-lg border transition-colors min-w-0',
        alreadyAdded
          ? 'border-green-500/20 bg-green-500/5 opacity-70'
          : 'border-border hover:border-primary/30 hover:bg-muted/30'
      )}
    >
      {/* Top row: Icon + Name + Transport | Docs */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Package className="size-3.5 text-muted-foreground shrink-0" />

        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          <span className="text-xs font-medium truncate">{entry.name}</span>
          <span className="text-[9px] text-muted-foreground font-mono bg-muted px-1 py-0.5 rounded shrink-0">
            {entry.transport}
          </span>
        </div>

        <button
          type="button"
          onClick={handleDocsClick}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-1"
        >
          Docs
          <ExternalLink className="size-2.5" />
        </button>
      </div>

      {/* Description */}
      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 break-words">
        {entry.description}
      </p>

      {/* Bottom row: Tags | Add Button */}
      <div className="flex items-center justify-between gap-1.5 min-w-0 relative">
        {/* Visible tags area */}
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
          <div className="flex gap-1 min-w-0">
            {entry.tags.map((tag, i) => (
              <span
                key={tag}
                className={cn(
                  'text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap shrink-0',
                  collapsed && i > 0 ? 'hidden' : ''
                )}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* The +x pill only renders if collapsed state is true */}
          {collapsed && entry.tags.length > 1 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap shrink-0">
              +{entry.tags.length - 1}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => !alreadyAdded && onAdd(entry)}
          disabled={alreadyAdded || adding}
          className={cn(
            'flex items-center justify-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0',
            alreadyAdded
              ? 'text-green-600 dark:text-green-400 cursor-default'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
          )}
        >
          {adding ? (
            <Loader2 className="size-3 animate-spin" />
          ) : alreadyAdded ? (
            '✓'
          ) : (
            <>
              <Plus className="size-2.5" />
              Add
            </>
          )}
        </button>

        {/*
          Hidden measurement div: Renders all tags invisibly to calculate
          their true combined width without affecting layout.
        */}
        <div
          ref={measureRef}
          className="invisible absolute top-0 left-0 flex gap-1 overflow-hidden pointer-events-none h-0"
          aria-hidden="true"
        >
          {entry.tags.map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap shrink-0">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
