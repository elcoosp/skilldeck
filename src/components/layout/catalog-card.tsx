// src/components/layout/catalog-card.tsx

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
        'flex items-start gap-2 px-3 py-2.5 rounded-lg border transition-colors overflow-hidden',
        alreadyAdded
          ? 'border-green-500/20 bg-green-500/5 opacity-70'
          : 'border-border hover:border-primary/30 hover:bg-muted/30'
      )}
    >
      <Package className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium truncate">{entry.name}</span>
          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded shrink-0">
            {entry.transport}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed w-full break-words">
          {entry.description}
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {entry.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 shrink-0 items-end w-14">
        <button
          type="button"
          onClick={() => !alreadyAdded && onAdd(entry)}
          disabled={alreadyAdded || adding}
          className={cn(
            'flex items-center justify-center gap-0.5 w-full px-1.5 py-1 rounded text-[11px] font-medium transition-colors',
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
        <button
          type="button"
          onClick={handleDocsClick}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Docs
          <ExternalLink className="size-2.5 shrink-0" />
        </button>
      </div>
    </div>
  )
}
