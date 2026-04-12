import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
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
        'flex items-center justify-between px-3 h-10 border-b border-border/50 shrink-0',
        className
      )}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
      >
        {title}
      </motion.span>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  )
}
