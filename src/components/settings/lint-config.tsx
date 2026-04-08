// src/components/settings/lint-config.tsx

import { openUrl } from '@tauri-apps/plugin-opener'
import { Settings2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useState } from 'react'
import { SettingsSection } from '@/components/settings/settings-section'
import { useDisableRule, useLintRules } from '@/hooks/use-lint'
import { DOCS_LINT_URL } from '@/lib/config'
import { cn } from '@/lib/utils'

const RULE_DESCRIPTIONS: Record<string, string> = {
  'fm-name-format': 'Skill name must be lowercase kebab-case',
  'fm-description-length': 'Description must be at least 20 characters',
  'fm-description-content': 'Description should not contain placeholder text',
  'fm-license-present': 'Skill should declare a license',
  'fm-license-format': 'License should be a valid SPDX identifier',
  'fm-compatibility-length': 'Compatibility list should not be empty',
  'fm-allowed-tools': 'allowed_tools field should be declared',
  'fm-metadata-keys': 'Required frontmatter keys must be present',
  'struct-skill-md-exists': 'SKILL.md must exist in the skill directory',
  'struct-skill-md-size': 'SKILL.md should not exceed 100 KB',
  'struct-references-exist': 'Referenced files must exist',
  'struct-references-depth': 'Directory nesting should not be too deep',
  'sec-dangerous-tools': 'Detect potentially dangerous shell commands',
  'sec-allowed-tools-mismatch':
    'Tools used should be declared in allowed_tools',
  'quality-content-clarity': 'Skill body should have reasonable length',
  'quality-content-examples': 'Skill should provide usage examples',
  'quality-content-steps': 'Skill should have structured instructions',
  'quality-progressive-disclosure': 'Long content should use section headings',
  'quality-dependencies': 'Dependencies should be documented',
  'quality-platform': 'Avoid hard-coded platform-specific paths',
  'quality-freshness': 'Skill should declare a version or last-updated date'
}

const RULE_CATEGORIES: Record<string, string[]> = {
  Frontmatter: [
    'fm-metadata-keys',
    'fm-name-format',
    'fm-description-length',
    'fm-description-content',
    'fm-license-present',
    'fm-license-format',
    'fm-compatibility-length',
    'fm-allowed-tools'
  ],
  Structure: [
    'struct-skill-md-exists',
    'struct-skill-md-size',
    'struct-references-exist',
    'struct-references-depth'
  ],
  Security: ['sec-dangerous-tools', 'sec-allowed-tools-mismatch'],
  Quality: [
    'quality-content-clarity',
    'quality-content-examples',
    'quality-content-steps',
    'quality-progressive-disclosure',
    'quality-dependencies',
    'quality-platform',
    'quality-freshness'
  ]
}

export function LintConfig() {
  const { data: _allRules, isLoading } = useLintRules()
  const disableRule = useDisableRule()
  const [disabledRules, setDisabledRules] = useState<Set<string>>(new Set())

  function toggleRule(ruleId: string) {
    if (disabledRules.has(ruleId)) {
      setDisabledRules((prev) => {
        const next = new Set(prev)
        next.delete(ruleId)
        return next
      })
    } else {
      disableRule.mutate(
        { ruleId, scope: 'global' },
        {
          onSuccess: () =>
            setDisabledRules((prev) => new Set([...prev, ruleId]))
        }
      )
    }
  }

  if (isLoading) {
    return <div className="text-xs text-muted-foreground">Loading rules…</div>
  }

  return (
    <div className="divide-y divide-border">
      <SettingsSection
        title="Lint Rules"
        description={
          <>
            Disabled rules are written to{' '}
            <code className="text-[10px] bg-muted px-1 rounded">
              ~/.config/skilldeck/skilldeck-lint.toml
            </code>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openUrl(DOCS_LINT_URL)}
              className="text-xs text-primary underline hover:no-underline"
            >
              Learn more about linting
            </button>
          </div>

          {Object.entries(RULE_CATEGORIES).map(([category, ruleIds]) => (
            <div key={category} className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {category}
              </p>
              <div className="space-y-0.5 rounded-lg border border-border overflow-hidden">
                {ruleIds.map((ruleId, i) => {
                  const isDisabled = disabledRules.has(ruleId)
                  return (
                    <div
                      key={ruleId}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 text-xs',
                        i > 0 && 'border-t border-border/50',
                        isDisabled && 'opacity-50'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {ruleId}
                        </p>
                        <p className="text-xs mt-0.5">
                          {RULE_DESCRIPTIONS[ruleId] ?? ruleId}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRule(ruleId)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        title={isDisabled ? 'Enable rule' : 'Disable rule'}
                        disabled={disableRule.isPending}
                      >
                        {isDisabled ? (
                          <ToggleLeft className="size-5" />
                        ) : (
                          <ToggleRight className="size-5 text-primary" />
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  )
}
