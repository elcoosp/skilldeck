// src/components/skills/install-dialog.tsx
// UX: Explicitly informs the user where the skill is being copied to.
// "Copy" mental model — not a live link.

import { FolderOpen, Home } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { RegistrySkillData } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface InstallDialogProps {
  skill: RegistrySkillData
  onClose: () => void
  onConfirm: (target: 'personal' | 'workspace') => void
}

export function InstallDialog({ skill, onClose, onConfirm }: InstallDialogProps) {
  const [target, setTarget] = useState<'personal' | 'workspace'>('personal')

  const targets: {
    value: 'personal' | 'workspace'
    label: string
    path: string
    icon: React.ReactNode
  }[] = [
      {
        value: 'personal',
        label: 'Personal',
        path: '~/.agents/skills/',
        icon: <Home className="size-4" />
      },
      {
        value: 'workspace',
        label: 'Workspace',
        path: './.skilldeck/skills/',
        icon: <FolderOpen className="size-4" />
      }
    ]

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Install Skill</DialogTitle>
          <DialogDescription>
            This will copy <strong>{skill.name}</strong> to your local machine.
            You can edit it freely — it won't change if the registry updates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Install location
          </p>
          {targets.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTarget(t.value)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                target === t.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                  target === t.value
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {t.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {t.path}
                </p>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(target)}>
            Install Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
