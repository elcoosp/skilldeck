// src/components/skills/blocked-skill-alert.tsx
// UX: High-risk skills (securityScore < 2) require an explicit interstitial
// before the user can proceed with installation.

import { ShieldAlert } from 'lucide-react'
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

interface BlockedSkillAlertProps {
  skill: RegistrySkillData
  onCancel: () => void
  onInstallAnyway: () => void
}

export function BlockedSkillAlert({
  skill,
  onCancel,
  onInstallAnyway
}: BlockedSkillAlertProps) {
  const securityErrors = skill.lintWarnings.filter(
    (w: any) => w.rule_id.startsWith('sec-') && w.severity === 'error'
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md border-red-200 dark:border-red-900/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <ShieldAlert className="size-5" />
            Security Warning
          </DialogTitle>
          <DialogDescription>
            This skill has been flagged for potentially dangerous behavior.
            Installing it may put your system at risk.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 p-3 space-y-2">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
            Issues detected ({securityErrors.length})
          </p>
          {securityErrors.map((w: any) => (
            <div key={w.rule_id} className="text-sm">
              <p className="font-medium text-red-700 dark:text-red-300">
                {w.message}
              </p>
              {w.suggested_fix && (
                <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
                  {w.suggested_fix}
                </p>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel (Recommended)
          </Button>
          <Button
            variant="destructive"
            onClick={onInstallAnyway}
            className="flex-1"
          >
            Install At My Own Risk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
