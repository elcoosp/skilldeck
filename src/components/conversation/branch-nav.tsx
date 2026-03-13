/**
 * BranchNav — compact navigation bar shown above the message thread when the
 * active conversation has multiple branches.
 *
 * Prev/Next arrows move through sibling branches; the branch indicator shows
 * "N of M" and the branch title.
 */

import { ChevronLeft, ChevronRight, GitBranch } from 'lucide-react'
import { useUIStore } from '@/store/ui'

/**
 * Minimal hook — in v1 branch metadata comes from the parent query.
 * This component accepts props directly; a future hook can supply them
 * from the DB once branch CRUD is wired.
 */
interface BranchNavProps {
  currentIndex?: number
  totalBranches?: number
  branchTitle?: string
  onPrev?: () => void
  onNext?: () => void
}

export function BranchNav({
  currentIndex = 1,
  totalBranches = 1,
  branchTitle,
  onPrev,
  onNext
}: BranchNavProps) {
  const setActiveBranch = useUIStore((s) => s.setActiveBranch)

  const hasPrev = currentIndex > 1
  const hasNext = currentIndex < totalBranches

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground bg-muted/40">
      <GitBranch className="size-3.5 shrink-0" />

      <button
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous branch"
        className="p-0.5 rounded hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="size-3.5" />
      </button>

      <span className="font-medium tabular-nums">
        {currentIndex} / {totalBranches}
      </span>

      <button
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next branch"
        className="p-0.5 rounded hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="size-3.5" />
      </button>

      {branchTitle && (
        <span className="truncate text-muted-foreground/70">{branchTitle}</span>
      )}

      <button
        onClick={() => setActiveBranch(null)}
        className="ml-auto text-[11px] hover:text-foreground transition-colors"
      >
        Exit branch
      </button>
    </div>
  )
}
