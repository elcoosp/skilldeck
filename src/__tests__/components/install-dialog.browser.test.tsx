// src/__tests__/components/install-dialog.browser.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { InstallDialog } from '@/components/skills/install-dialog'
import type { RegistrySkillData } from '@/lib/bindings'

const skill: RegistrySkillData = {
  id: 'skill-1',
  name: 'my-skill',
  description: 'Does things',
  source: 'registry',
  sourceUrl: null,
  version: '1.0.0',
  author: null,
  license: null,
  tags: [],
  category: null,
  lintWarnings: [],
  securityScore: 4,
  qualityScore: 4,
  metadataSource: 'registry',
  content: '# x',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01'
}

describe('InstallDialog', () => {
  it('renders the skill name and both install locations', async () => {
    const screen = await render(
      <InstallDialog skill={skill} onClose={vi.fn()} onConfirm={vi.fn()} />
    )
    await expect.element(screen.getByText('Install Skill')).toBeInTheDocument()
    await expect.element(screen.getByText('my-skill')).toBeInTheDocument()
    await expect.element(screen.getByText('Personal')).toBeInTheDocument()
    await expect.element(screen.getByText('Workspace')).toBeInTheDocument()
    await expect
      .element(screen.getByText('~/.agents/skills/'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('./.skilldeck/skills/'))
      .toBeInTheDocument()
  })

  it('confirms with the personal default target', async () => {
    const onConfirm = vi.fn()
    const screen = await render(
      <InstallDialog skill={skill} onClose={vi.fn()} onConfirm={onConfirm} />
    )
    await screen.getByRole('button', { name: 'Install Copy' }).click()
    expect(onConfirm).toHaveBeenCalledWith('personal')
  })

  it('confirms with the workspace target after selecting it', async () => {
    const onConfirm = vi.fn()
    const screen = await render(
      <InstallDialog skill={skill} onClose={vi.fn()} onConfirm={onConfirm} />
    )
    await screen.getByRole('button', { name: 'Workspace' }).click()
    await screen.getByRole('button', { name: 'Install Copy' }).click()
    expect(onConfirm).toHaveBeenCalledWith('workspace')
  })

  it('calls onClose from the Cancel button', async () => {
    const onClose = vi.fn()
    const screen = await render(
      <InstallDialog skill={skill} onClose={onClose} onConfirm={vi.fn()} />
    )
    await screen.getByRole('button', { name: 'Cancel' }).click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
