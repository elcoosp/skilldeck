// src/hooks/use-lint.ts
// React Query hooks for skill linting.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  disableLintRule,
  getLintRules,
  lintAllLocalSources,
  lintSkill,
  type LintWarning
} from '@/lib/invoke'
import { toast } from 'sonner'

// ── Single skill lint ─────────────────────────────────────────────────────────

export function useLintSkill(skillPath: string | null) {
  return useQuery({
    queryKey: ['lint', 'skill', skillPath],
    queryFn: () => lintSkill(skillPath!),
    enabled: !!skillPath,
    staleTime: 60_000,
    retry: false
  })
}

// ── All local sources lint ────────────────────────────────────────────────────

export function useLintAllLocalSources() {
  return useQuery({
    queryKey: ['lint', 'all-local'],
    queryFn: lintAllLocalSources,
    staleTime: 60_000,
    retry: false
  })
}

// ── Lint rules list ───────────────────────────────────────────────────────────

export function useLintRules() {
  return useQuery({
    queryKey: ['lint', 'rules'],
    queryFn: getLintRules,
    staleTime: Infinity
  })
}

// ── Disable rule mutation ─────────────────────────────────────────────────────

export function useDisableRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      ruleId,
      scope
    }: {
      ruleId: string
      scope: 'global' | 'workspace'
    }) => disableLintRule(ruleId, scope),
    onSuccess: (_data, { ruleId, scope }) => {
      toast.success(`Rule "${ruleId}" disabled for ${scope} scope`)
      // Invalidate all lint caches so they re-run without the disabled rule.
      queryClient.invalidateQueries({ queryKey: ['lint'] })
    },
    onError: (error: unknown) => {
      toast.error(`Failed to disable rule: ${error}`)
    }
  })
}

// ── Severity helpers ──────────────────────────────────────────────────────────

export function getWarningCounts(warnings: LintWarning[]) {
  return {
    errors: warnings.filter((w) => w.severity === 'error').length,
    warnings: warnings.filter((w) => w.severity === 'warning').length,
    infos: warnings.filter((w) => w.severity === 'info').length,
    total: warnings.filter((w) => w.severity !== 'off').length
  }
}

export function hasSecurityIssues(warnings: LintWarning[]) {
  return warnings.some(
    (w) => w.rule_id.startsWith('sec-') && w.severity === 'error'
  )
}
