// src/components/skills/empty-state-local.tsx
import { FolderOpen } from 'lucide-react'

export function EmptyStateLocal() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <FolderOpen className="h-12 w-12 text-muted-foreground mb-3" />
      <h3 className="text-base font-semibold mb-1">No local skills</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Skills you create or install will appear here.
      </p>
    </div>
  )
}
