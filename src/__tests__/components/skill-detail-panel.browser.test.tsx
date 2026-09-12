// src/__tests__/components/skill-detail-panel.browser.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SkillDetailPanel } from '@/components/skills/skill-detail-panel'
import { toast } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { commands } from '@/lib/bindings'
import type { UnifiedSkill } from '@/types/skills'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(),
  revealItemInDir: vi.fn()
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryClientProvider>
)

const installedSkill: UnifiedSkill = {
  id: 's1',
  name: 'my-skill',
  description: 'A test skill',
  status: 'installed',
  localData: {
    name: 'my-skill',
    description: 'A test skill',
    is_active: true,
    source: 'personal',
    path: '/skills/my-skill',
    lint_warnings: [],
    security_score: 4,
    quality_score: 4
  },
  registryData: {
    id: 's1',
    name: 'my-skill',
    description: 'A test skill',
    source: 'registry',
    sourceUrl: 'https://example.com/my-skill',
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

const availableSkill: UnifiedSkill = {
  id: 's3',
  name: 'registry-only',
  description: 'From registry',
  status: 'available',
  registryData: {
    id: 's3',
    name: 'registry-only',
    description: 'From registry',
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

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  vi.spyOn(commands, 'installSkill').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.spyOn(commands, 'uninstallSkill').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.spyOn(commands, 'syncRegistrySkills').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.spyOn(commands, 'lintSkill').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.spyOn(commands, 'disableLintRule').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.spyOn(commands, 'getInstalledSkillContent').mockResolvedValue({
    status: 'ok',
    data: '# content'
  })
  vi.spyOn(commands, 'diffSkillVersions').mockResolvedValue({
    status: 'ok',
    data: { diff: '-a\n+b' }
  })
})

describe('SkillDetailPanel', () => {
  it('renders the installed skill with its metadata', async () => {
    const screen = await render(
      <SkillDetailPanel skill={installedSkill} onClose={vi.fn()} />,
      { wrapper }
    )
    await expect
      .element(screen.getByRole('heading', { name: 'my-skill' }))
      .toBeInTheDocument()
    await expect.element(screen.getByText('installed')).toBeInTheDocument()
    await expect.element(screen.getByText('Personal')).toBeInTheDocument()
    await expect.element(screen.getByText('bob')).toBeInTheDocument()
    await expect
      .element(screen.getByText('1.0.0', { exact: true }))
      .toBeInTheDocument()
    await expect.element(screen.getByText('Open Folder')).toBeInTheDocument()
    await expect.element(screen.getByText('Share as Gist')).toBeInTheDocument()
  })

  it('shows the install dialog for an available skill and installs', async () => {
    const screen = await render(
      <SkillDetailPanel skill={availableSkill} onClose={vi.fn()} />,
      { wrapper }
    )
    await screen.getByRole('button', { name: 'Install Skill' }).click()
    await expect
      .element(screen.getByText('Install location'))
      .toBeInTheDocument()
    await screen.getByText('Workspace').click()
    await screen.getByRole('button', { name: 'Install Copy' }).click()
    expect(commands.installSkill).toHaveBeenCalledWith(
      'registry-only',
      '# x',
      'workspace',
      null
    )
    expect(toast.success).toHaveBeenCalledWith('Skill installed successfully')
  })

  it('calls onClose via the back button', async () => {
    const onClose = vi.fn()
    const screen = await render(
      <SkillDetailPanel skill={installedSkill} onClose={onClose} />,
      { wrapper }
    )
    await screen.getByRole('button').first().click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uninstalls the skill', async () => {
    const screen = await render(
      <SkillDetailPanel skill={installedSkill} onClose={vi.fn()} />,
      { wrapper }
    )
    await screen.getByRole('button', { name: 'Uninstall' }).click()
    expect(commands.uninstallSkill).toHaveBeenCalledWith('my-skill', 'personal')
    expect(toast.success).toHaveBeenCalledWith('Skill uninstalled')
  })

  it('reruns lint via Re-lint', async () => {
    const screen = await render(
      <SkillDetailPanel skill={installedSkill} onClose={vi.fn()} />,
      { wrapper }
    )
    await screen.getByRole('button', { name: 'Re-lint' }).click()
    expect(commands.lintSkill).toHaveBeenCalledWith('/skills/my-skill', null)
    expect(toast.success).toHaveBeenCalledWith('Lint check complete')
  })

  it('opens the share modal and reads skill content', async () => {
    const screen = await render(
      <SkillDetailPanel skill={installedSkill} onClose={vi.fn()} />,
      { wrapper }
    )
    await screen.getByRole('button', { name: 'Share as Gist' }).click()
    await expect.element(screen.getByText('Share Skill')).toBeInTheDocument()
    expect(commands.getInstalledSkillContent).toHaveBeenCalledWith(
      'my-skill',
      'personal'
    )
  })

  it('opens a blocked-skill dialog for low-security registry skills', async () => {
    const lowSecurity = {
      ...availableSkill,
      registryData: {
        ...availableSkill.registryData!,
        securityScore: 1
      }
    }
    const screen = await render(
      <SkillDetailPanel skill={lowSecurity} onClose={vi.fn()} />,
      { wrapper }
    )
    await screen.getByRole('button', { name: 'Install Skill' }).click()
    await expect
      .element(screen.getByText('Security Warning'))
      .toBeInTheDocument()
  })
})
