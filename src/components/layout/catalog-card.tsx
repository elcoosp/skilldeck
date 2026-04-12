// src/components/layout/catalog-card.tsx

import { ReactNode, useState } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Check, ExternalLink, Loader2, Package, Plus } from 'lucide-react'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { CatalogEntry } from './mcp-tab'

interface CatalogCardProps {
  entry: CatalogEntry
  alreadyAdded: boolean
  adding: boolean
  onAdd: (entry: CatalogEntry) => void
  icon?: ReactNode
}

export function CatalogCard({
  entry,
  alreadyAdded,
  adding,
  onAdd,
  icon
}: CatalogCardProps) {
  const [expanded, setExpanded] = useState(false)

  const handleDocsClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await openUrl(entry.docsUrl)
    } catch (e) {
      toast.error(`Failed to open link: ${e}`)
    }
  }

  const toggleDescription = () => setExpanded((prev) => !prev)

  return (
    <div className="@container/card w-full min-w-0">
      <div
        className={cn(
          'flex flex-col gap-1 p-2 rounded-md border transition-colors w-full min-w-0',
          alreadyAdded
            ? 'border-green-500/20 bg-green-500/5 opacity-70'
            : 'border-border hover:border-primary/30 hover:bg-muted/30'
        )}
      >
        {/* Header: Icon + Name + Transport + Docs */}
        <div className="flex items-center gap-1 min-w-0">
          <div className="shrink-0 text-muted-foreground">
            {icon ?? <Package className="size-3.5" />}
          </div>

          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="text-sm @[180px]/card:text-base font-medium truncate">
              {entry.name}
            </span>
            <span className="text-[10px] leading-none text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded-sm shrink-0 uppercase tracking-wide">
              {entry.transport}
            </span>
          </div>

          <button
            type="button"
            onClick={handleDocsClick}
            className="text-[11px] @[180px]/card:text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 flex items-center gap-0.5"
            aria-label="Open documentation"
          >
            <span className="hidden @[160px]/card:inline">Docs</span>
            <ExternalLink className="size-3" />
          </button>
        </div>

        {/* Description — click to expand/collapse, no animation */}
        <button
          type="button"
          onClick={toggleDescription}
          className="text-left cursor-pointer group/desc w-full"
          aria-expanded={expanded}
        >
          <p
            className={cn(
              'text-xs @[200px]/card:text-sm text-muted-foreground leading-snug break-words',
              expanded ? 'line-clamp-none' : 'line-clamp-1',
              'group-hover/desc:text-foreground/80'
            )}
          >
            {entry.description}
          </p>
        </button>

        {/* Footer: All tags + Add button */}
        <div className="flex items-start justify-between gap-1.5 mt-0.5">
          <div className="flex flex-wrap gap-1 min-w-0 flex-1">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] @[180px]/card:text-xs px-1 @[180px]/card:px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap shrink-0"
              >
                {tag}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => !alreadyAdded && onAdd(entry)}
            disabled={alreadyAdded || adding}
            className={cn(
              'flex items-center justify-center rounded font-medium transition-colors shrink-0',
              alreadyAdded
                ? 'text-green-600 dark:text-green-400 cursor-default'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50',
              'p-1 w-6 h-6 text-[0px]',
              '@[200px]/card:w-auto @[200px]/card:h-auto @[200px]/card:px-2 @[200px]/card:py-1 @[200px]/card:text-xs @[200px]/card:gap-1'
            )}
            aria-label={alreadyAdded ? 'Added' : 'Add'}
          >
            {adding ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : alreadyAdded ? (
              <Check className="size-3.5" />
            ) : (
              <>
                <Plus className="size-3.5" />
                <span className="hidden @[200px]/card:inline">Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
