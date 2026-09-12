// src/__tests__/components/unified-skill-card.browser.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { UnifiedSkillCard } from '@/components/skills/unified-skill-card'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUIPersistentStore } from '@/store/ui-state'
import type { UnifiedSkill } from '@/types/skills'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>{children}</TooltipProvider>
)

const baseSkill: UnifiedSkill = {
  id: 's1',
  name: 'my-skill',
  description: 'A test skill',
  status: 'available',
  registryData: {
    id: 's1',
    name: 'my-skill',
    description: 'A test skill',
    source: 'registry',
    sourceUrl: null,
    version: '1.0.0',
    author: 'bob',
    license: 'MIT',
    tags: ['ts'],
    category: 'coding',
    lintWarnings: [],
    securityScore: 4,
    qualityScore: 4,
    metadataSource: 'registry',
    content: '# x',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
}

const localSkill = (overrides: Partial<UnifiedSkill> = {}): UnifiedSkill => ({
  id: 's2',
  name: 'local-skill',
  description: 'A local skill',
  status: 'installed',
  localData: {
    name: 'local-skill',
    description: 'A local skill',
    is_active: true,
    source: 'registry',
    path: '/skills/local-skill',
    lint_warnings: [
      {
        rule_id: 'sec-foo',
        severity: 'error',
        message: 'bad',
        location: null,
        suggested_fix: null
      }
    ],
    security_score: 4,
    quality_score: 4
  },
  ...overrides
})

beforeEach(() => {
  useUIPersistentStore.setState({ platformFeaturesEnabled: true })
})

describe('UnifiedSkillCard', () => {
  it('renders the available status with install action when platform is enabled', async () => {
    const onInstall = vi.fn()
    const screen = await render(
      <UnifiedSkillCard
        skill={baseSkill}
        onClick={vi.fn()}
        onInstall={onInstall}
      />,
      { wrapper }
    )
    await expect.element(screen.getByText('my-skill')).toBeInTheDocument()
    await expect.element(screen.getByText('Available')).toBeInTheDocument()
    await expect.element(screen.getByText('bob')).toBeInTheDocument()
    await screen.getByRole('button', { name: 'Install', exact: true }).click()
    expect(onInstall).toHaveBeenCalledWith(baseSkill)
  })

  it('renders the installed status and hidden install action', async () => {
    const onInstall = vi.fn()
    const screen = await render(
      <UnifiedSkillCard
        skill={localSkill()}
        onClick={vi.fn()}
        onInstall={onInstall}
      />,
      { wrapper }
    )
    await expect.element(screen.getByText('Installed')).toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: 'Install', exact: true }))
      .not.toBeInTheDocument()
  })

  it('renders the update status with an Update action', async () => {
    const onUpdate = vi.fn()
    const screen = await render(
      <UnifiedSkillCard
        skill={localSkill({ status: 'update_available' })}
        onClick={vi.fn()}
        onUpdate={onUpdate}
      />,
      { wrapper }
    )
    await expect
      .element(screen.getByRole('button', { name: 'Update', exact: true }))
      .toBeInTheDocument()
    await screen.getByRole('button', { name: 'Update', exact: true }).click()
    expect(onUpdate).toHaveBeenCalledWith(
      localSkill({ status: 'update_available' })
    )
  })

  it('hides install/update actions when platform features are disabled', async () => {
    useUIPersistentStore.setState({ platformFeaturesEnabled: false })
    const onInstall = vi.fn()
    const screen = await render(
      <UnifiedSkillCard
        skill={baseSkill}
        onClick={vi.fn()}
        onInstall={onInstall}
      />,
      { wrapper }
    )
    await expect
      .element(screen.getByRole('button', { name: 'Install', exact: true }))
      .not.toBeInTheDocument()
  })

  it('renders the list variant with a click handler', async () => {
    const onClick = vi.fn()
    const screen = await render(
      <UnifiedSkillCard skill={baseSkill} onClick={onClick} variant="list" />,
      { wrapper }
    )
    await expect.element(screen.getByText('my-skill')).toBeInTheDocument()
    await screen.getByText('my-skill').click()
    expect(onClick).toHaveBeenCalledWith(baseSkill)
  })

  it('triggers onClick on Enter keydown', async () => {
    const onClick = vi.fn()
    const screen = await render(
      <UnifiedSkillCard skill={baseSkill} onClick={onClick} variant="list" />,
      { wrapper }
    )
    const card = screen.getByRole('button')
    card
      .element()
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      )
    expect(onClick).toHaveBeenCalledWith(baseSkill)
  })

  it('shows the lint error count badge', async () => {
    const screen = await render(
      <UnifiedSkillCard skill={localSkill()} onClick={vi.fn()} />,
      { wrapper }
    )
    await expect.element(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders "No description" placeholder when description is empty', async () => {
    const screen = await render(
      <UnifiedSkillCard
        skill={{ ...baseSkill, description: '' }}
        onClick={vi.fn()}
      />,
      { wrapper }
    )
    await expect.element(screen.getByText('No description')).toBeInTheDocument()
  })
})
