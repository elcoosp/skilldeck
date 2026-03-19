// src/components/skills/platform-status-banner.tsx
import { AlertCircle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PlatformStatusBannerProps {
  variant: 'disabled' | 'error' | null
  onEnable?: () => void
  onRetry?: () => void
  onRegister?: () => void // new
  errorMessage?: string // new
}

export function PlatformStatusBanner({
  variant,
  onEnable,
  onRetry,
  onRegister,
  errorMessage
}: PlatformStatusBannerProps) {
  if (!variant) return null

  if (variant === 'disabled') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-lg border p-3 mb-3',
          'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Platform features are disabled. Connect to browse community skills.
          </span>
        </div>
        <Button size="xs" variant="outline" onClick={onEnable}>
          <Settings className="h-3 w-3 mr-1" />
          Enable
        </Button>
      </div>
    )
  }

  // Check for "Not configured" error
  if (errorMessage?.includes('Not configured')) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-lg border p-3 mb-3',
          'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Platform not registered.</span>
        </div>
        <Button size="xs" variant="outline" onClick={onRegister}>
          Register
        </Button>
      </div>
    )
  }

  // generic error variant
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border p-3 mb-3',
        'bg-destructive/10 border-destructive/20 text-destructive'
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Cannot connect to skill registry.</span>
      </div>
      <Button size="xs" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
