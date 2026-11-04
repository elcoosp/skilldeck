import type { JsonValue, LintWarning } from '@/lib/bindings'

/**
 * Narrow an opaque lint warning coming from backend JSON payloads
 * (e.g. `RegistrySkillData.lintWarnings`, which is typed as `JsonValue[]`).
 */
export const isLintWarning = (value: JsonValue): value is LintWarning => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  return (
    typeof value.rule_id === 'string' &&
    (value.severity === 'error' ||
      value.severity === 'warning' ||
      value.severity === 'info' ||
      value.severity === 'off') &&
    typeof value.message === 'string'
  )
}
