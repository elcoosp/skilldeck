import { cn } from '@/lib/utils'
import React from 'react'

interface RightPanelHeaderProps {
  title: string
  actions?: React.ReactNode
  className?: string
}

export function RightPanelHeader({
  title,
  actions,
  className
}: RightPanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2 border-b border-border/50 shrink-0',
        className
      )}
    >
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  )
}
