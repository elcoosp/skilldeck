// src/components/chat/security-warning-dialog.tsx
import React from 'react'
import type { RegistrySkillData } from '@/lib/bindings'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { AlertTriangle } from 'lucide-react'

interface SecurityWarningDialogProps {
  skill: RegistrySkillData
  onConfirm: () => void
  onCancel: () => void
}

export const SecurityWarningDialog: React.FC<SecurityWarningDialogProps> = ({
  skill,
  onConfirm,
  onCancel
}) => {
  // Treat lintWarnings as opaque JSON values from the backend
  const rawWarnings = skill.lintWarnings as unknown as Array<{
    rule_id?: string
    severity?: string
    message?: string
  }>

  const securityWarnings = rawWarnings.filter(
    (w) =>
      (w.rule_id && w.rule_id.includes('sec-')) || w.severity === 'error'
  )

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Security Warning
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p>
                The skill <strong>{skill.name}</strong> has been flagged for potentially
                dangerous behaviour.
              </p>
              {securityWarnings.length > 0 && (
                <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive border border-destructive/20 max-h-40 overflow-y-auto">
                  {securityWarnings.map((w, i) => (
                    <div key={i} className="mb-1">
                      • {w.message ?? String(w)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancel (Recommended)
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Add At My Own Risk
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
