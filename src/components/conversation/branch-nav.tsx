/**
 * BranchNav — compact navigation bar shown above the message thread when the
 * active conversation has multiple branches.
 *
 * Prev/Next arrows move through sibling branches, and can also return to the
 * main (root) conversation. The main conversation is visually distinguished.
 */

import { ChevronLeft, ChevronRight, GitBranch, Home } from 'lucide-react'
import { useBranches } from '@/hooks/use-branches'
import { useConversationStore } from '@/store/conversation'

interface BranchNavProps {
  conversationId: string
}

export function BranchNav({ conversationId }: BranchNavProps) {
  const activeBranchId = useConversationStore((s) => s.activeBranchId)
  const setActiveBranch = useConversationStore((s) => s.setActiveBranch)
  const { data: branches = [], isLoading } = useBranches(conversationId)

  if (isLoading || branches.length === 0) return null

  const total = branches.length
  const isOnMain = activeBranchId === null

  // Determine which branch we are on (1‑based index, only meaningful when on a branch)
  const currentBranchIndex = !isOnMain
    ? branches.findIndex((b) => b.id === activeBranchId) + 1
    : 0

  // Arrow availability
  const prevEnabled = !isOnMain && currentBranchIndex > 1
  const nextEnabled = (isOnMain && total > 0) || (!isOnMain && currentBranchIndex < total)

  const handlePrev = () => {
    if (isOnMain) return
    if (currentBranchIndex === 1) {
      // First branch -> go back to main conversation
      setActiveBranch(null)
    } else {
      // Go to previous branch (branches are 1‑based in the array)
      setActiveBranch(branches[currentBranchIndex - 2].id)
    }
  }

  const handleNext = () => {
    if (isOnMain && total > 0) {
      // From main to first branch
      setActiveBranch(branches[0].id)
    } else if (!isOnMain && currentBranchIndex < total) {
      // Next branch
      setActiveBranch(branches[currentBranchIndex].id)
    }
  }

  const currentBranch = !isOnMain ? branches.find((b) => b.id === activeBranchId) : null

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground bg-muted/40">
      {/* Icon and indicator */}
      {isOnMain ? (
        <>
          <Home className="size-3.5 shrink-0" />
          <span className="font-medium">Main</span>
          {total > 0 && <span className="text-muted-foreground/60">({total})</span>}
        </>
      ) : (
        <>
          <GitBranch className="size-3.5 shrink-0" />
          <span className="font-medium tabular-nums">
            {currentBranchIndex} / {total}
          </span>
        </>
      )}

      {/* Navigation arrows */}
      <button
        type="button"
        onClick={handlePrev}
        disabled={!prevEnabled}
        aria-label="Previous branch"
        className="p-0.5 rounded hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={handleNext}
        disabled={!nextEnabled}
        aria-label="Next branch"
        className="p-0.5 rounded hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="size-3.5" />
      </button>

      {/* Branch name (only when on a branch) */}
      {!isOnMain && currentBranch?.name && (
        <span className="truncate text-muted-foreground/70">
          {currentBranch.name}
        </span>
      )}

      {/* Exit branch button (only when on a branch) */}
      {!isOnMain && (
        <button
          type="button"
          onClick={() => setActiveBranch(null)}
          className="ml-auto text-[11px] hover:text-foreground transition-colors"
        >
          Exit branch
        </button>
      )}
    </div>
  )
}
