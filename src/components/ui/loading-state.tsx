import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  message?: string
  variant?: 'pulse' | 'spinner' | 'shimmer'
  className?: string
}

export function LoadingState({
  message,
  variant = 'pulse',
  className
}: LoadingStateProps) {
  if (variant === 'spinner') {
    return (
      <div className={cn('flex items-center justify-center gap-2 py-8', className)}>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </div>
    )
  }

  if (variant === 'shimmer') {
    return (
      <div className={cn('flex flex-col gap-2 py-4', className)}>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
        <div className="h-16 w-full animate-pulse rounded-lg bg-gradient-to-r from-muted/50 via-muted to-muted/50 bg-[length:200%_100%]" />
      </div>
    )
  }

  // pulse (default) – subtle breathing indicator
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-8', className)}>
      <div className="relative">
        <div className="size-2 rounded-full bg-primary/30 animate-ping absolute inset-0" />
        <div className="size-2 rounded-full bg-primary/60 relative" />
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}
