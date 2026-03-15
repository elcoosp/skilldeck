// src/components/skills/conflict-resolver.tsx
// UX: Shows a diff view when a local skill version diverges from the registry.

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ConflictResolverProps {
  skillName: string
  diff: string
  onKeepLocal: () => void
  onOverwrite: () => void
  onClose: () => void
}

export function ConflictResolver({
  skillName,
  diff,
  onKeepLocal,
  onOverwrite,
  onClose
}: ConflictResolverProps) {
  const lines = diff.split('\n')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Update Available — {skillName}
          </DialogTitle>
          <DialogDescription>
            Your local version of this skill differs from the registry version.
            Review the changes below and choose how to proceed.
          </DialogDescription>
        </DialogHeader>

        {/* Diff view */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 border-b border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
              Local
            </span>
            <span className="text-muted-foreground/50">vs</span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
              Registry
            </span>
          </div>
          <ScrollArea className="h-64">
            <pre className="p-3 text-xs font-mono leading-5">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    'px-1 rounded-sm',
                    line.startsWith('-') &&
                      'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
                    line.startsWith('+') &&
                      'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                  )}
                >
                  {line || ' '}
                </div>
              ))}
            </pre>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onKeepLocal}
            className="flex-1"
          >
            Keep Local
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Manual Merge
          </Button>
          <Button
            onClick={onOverwrite}
            className="flex-1"
          >
            Overwrite with Registry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
