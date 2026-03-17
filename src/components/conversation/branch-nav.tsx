/**
 * BranchNav — compact navigation bar shown above the message thread when the
 * active conversation has multiple branches.
 *
 * Prev/Next arrows move through sibling branches; the branch indicator shows
 * "N of M" and the branch title.
 */

import { ChevronLeft, ChevronRight, GitBranch } from 'lucide-react'
import { useBranches } from '@/hooks/use-branches'
import { useUIStore } from '@/store/ui'

interface BranchNavProps {
  conversationId: string
}

export function BranchNav({ conversationId }: BranchNavProps) {
  const activeBranchId = useUIStore((s) => s.activeBranchId)
  const setActiveBranch = useUIStore((s) => s.setActiveBranch)
  const { data: branches = [], isLoading } = useBranches(conversationId)

  if (isLoading || branches.length <= 1) return null // don't show if only main trunk

  const currentIndex = branches.findIndex((b) => b.id === activeBranchId) + 1 // 1-based for display
  const total = branches.length

  const goPrev = () => {
    if (currentIndex > 1) {
      setActiveBranch(branches[currentIndex - 2].id)
    }
  }

  const goNext = () => {
    if (currentIndex < total) {
      setActiveBranch(branches[currentIndex].id)
    }
  }

  const currentBranch = branches.find((b) => b.id === activeBranchId)

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground bg-muted/40">
      <GitBranch className="size-3.5 shrink-0" />

      <button
        onClick={goPrev}
        disabled={currentIndex <= 1}
        aria-label="Previous branch"
        className="p-0.5 rounded hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="size-3.5" />
      </button>

      <span className="font-medium tabular-nums">
        {currentIndex} / {total}
      </span>

      <button
        onClick={goNext}
        disabled={currentIndex >= total}
        aria-label="Next branch"
        className="p-0.5 rounded hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="size-3.5" />
      </button>

      {currentBranch?.name && (
        <span className="truncate text-muted-foreground/70">
          {currentBranch.name}
        </span>
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
