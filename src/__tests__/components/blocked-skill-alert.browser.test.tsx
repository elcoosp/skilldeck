// src/__tests__/components/blocked-skill-alert.browser.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { BlockedSkillAlert } from '@/components/skills/blocked-skill-alert'
import type { LintWarning, RegistrySkillData } from '@/lib/bindings'

const warning = (overrides: Partial<LintWarning> = {}): LintWarning => ({
  rule_id: 'sec-network-1',
  severity: 'error',
  message: 'Makes network requests',
  location: null,
  suggested_fix: null,
  ...overrides
})

const skill: RegistrySkillData = {
  id: 'skill-1',
  name: 'evil-skill',
  description: 'A dangerous skill',
  source: 'registry',
  sourceUrl: null,
  version: '1.0.0',
  author: null,
  license: null,
  tags: [],
  category: null,
  lintWarnings: [
    warning(),
    warning({
      rule_id: 'sec-network-2',
      message: 'Sends data over the network',
      suggested_fix: 'Remove network sending'
    }),
    warning({
      rule_id: 'style-1',
      severity: 'warning',
      message: 'Style nit',
      suggested_fix: null
    })
  ],
  securityScore: 1,
  qualityScore: 5,
  metadataSource: 'registry',
  content: '# x',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01'
}

describe('BlockedSkillAlert', () => {
  it('renders security warnings and the count of security errors only', async () => {
    const screen = await render(
      <BlockedSkillAlert
        skill={skill}
        onCancel={vi.fn()}
        onInstallAnyway={vi.fn()}
      />
    )
    await expect
      .element(screen.getByText('Security Warning'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('Issues detected (2)'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('Makes network requests'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('Sends data over the network'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('Remove network sending'))
      .toBeInTheDocument()
    await expect.element(screen.getByText('Style nit')).not.toBeInTheDocument()
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const screen = await render(
      <BlockedSkillAlert
        skill={skill}
        onCancel={onCancel}
        onInstallAnyway={vi.fn()}
      />
    )
    await screen.getByRole('button', { name: 'Cancel (Recommended)' }).click()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onInstallAnyway when installing at own risk', async () => {
    const onInstallAnyway = vi.fn()
    const screen = await render(
      <BlockedSkillAlert
        skill={skill}
        onCancel={vi.fn()}
        onInstallAnyway={onInstallAnyway}
      />
    )
    await screen.getByRole('button', { name: 'Install At My Own Risk' }).click()
    expect(onInstallAnyway).toHaveBeenCalledTimes(1)
  })
})
