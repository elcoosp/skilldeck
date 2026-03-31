// src/components/skills/empty-state-registry.tsx
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateRegistryProps {
  onSync: () => void
  isSyncing?: boolean
}

export function EmptyStateRegistry({
  onSync,
  isSyncing
}: EmptyStateRegistryProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <img
        src="/illustrations/empty-skills.jpeg"
        alt="No registry skills"
        className="w-48 h-48 mb-4 opacity-90 rounded-3xl"
      />
      <h3 className="text-base font-semibold mb-1">No skills in registry</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-4">
        Try syncing with the platform or check your connection.
      </p>
      <Button size="sm" onClick={onSync} disabled={isSyncing}>
        <RefreshCw
          className={`size-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`}
        />
        Sync now
      </Button>
    </div>
  )
}
