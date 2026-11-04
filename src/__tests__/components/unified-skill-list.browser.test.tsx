// src/__tests__/components/unified-skill-list.browser.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { UnifiedSkillList } from '@/components/skills/unified-skill-list'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useUnifiedSkills } from '@/hooks/use-unified-skills'
import { useUIPersistentStore } from '@/store/ui-state'
import type { UnifiedSkill } from '@/types/skills'

vi.mock('@/hooks/use-unified-skills', () => ({
  useUnifiedSkills: vi.fn()
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: vi.fn() })
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number }) => {
    const size = opts.estimateSize()
    return {
      getTotalSize: () => opts.count * size,
      getVirtualItems: () =>
        Array.from({ length: opts.count }, (_, index) => ({
          index,
          start: index * size,
          size,
          key: index,
          lane: 0
        })),
      measureElement: () => size
    }
  }
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryClientProvider>
)

const makeSkill = (overrides: Partial<UnifiedSkill>): UnifiedSkill => ({
  id: overrides.name ?? 's',
  name: 's',
  description: 'desc',
  status: 'installed',
  ...overrides
})

beforeEach(() => {
  useUIPersistentStore.setState({ platformFeaturesEnabled: true })
  vi.mocked(useUnifiedSkills).mockReturnValue({
    unifiedSkills: [],
    isLoading: false,
    localError: null,
    registryError: null,
    installedCount: 0
  })
})

describe('UnifiedSkillList', () => {
  it('shows the loading state while skills are loading', async () => {
    vi.mocked(useUnifiedSkills).mockReturnValue({
      unifiedSkills: [],
      isLoading: true,
      localError: null,
      registryError: null,
      installedCount: 0
    })
    const screen = await render(<UnifiedSkillList />, { wrapper })
    await expect
      .element(screen.getByText('Loading skill registry…'))
      .toBeInTheDocument()
  })

  it('lists local skills in the local tab', async () => {
    vi.mocked(useUnifiedSkills).mockReturnValue({
      unifiedSkills: [
        makeSkill({
          name: 'alpha',
          description: 'Alpha skill',
          status: 'installed'
        }),
        makeSkill({
          name: 'beta',
          description: 'Beta skill',
          status: 'local_only'
        })
      ],
      isLoading: false,
      localError: null,
      registryError: null,
      installedCount: 2
    })
    const screen = await render(<UnifiedSkillList />, { wrapper })
    await expect.element(screen.getByText('Alpha skill')).toBeInTheDocument()
    await expect.element(screen.getByText('Beta skill')).toBeInTheDocument()
  })

  it('filters registry skills into the registry tab', async () => {
    vi.mocked(useUnifiedSkills).mockReturnValue({
      unifiedSkills: [
        makeSkill({
          name: 'alpha',
          description: 'Alpha skill',
          status: 'installed'
        }),
        makeSkill({
          name: 'gamma',
          description: 'Gamma skill',
          status: 'available'
        })
      ],
      isLoading: false,
      localError: null,
      registryError: null,
      installedCount: 1
    })
    const screen = await render(<UnifiedSkillList />, { wrapper })
    await screen.getByRole('tab', { name: 'Registry' }).click()
    await expect.element(screen.getByText('Gamma skill')).toBeInTheDocument()
    await expect
      .element(screen.getByText('Alpha skill'))
      .not.toBeInTheDocument()
  })

  it('renders the registry empty state when the registry tab has no available skills', async () => {
    vi.mocked(useUnifiedSkills).mockReturnValue({
      unifiedSkills: [
        makeSkill({
          name: 'alpha',
          description: 'Alpha skill',
          status: 'installed'
        })
      ],
      isLoading: false,
      localError: null,
      registryError: null,
      installedCount: 1
    })
    const screen = await render(<UnifiedSkillList />, { wrapper })
    await expect.element(screen.getByText('Alpha skill')).toBeInTheDocument()
    await screen.getByRole('tab', { name: 'Registry' }).click()
    await expect
      .element(screen.getByText('No registry skills'))
      .toBeInTheDocument()
  })

  it('shows the platform-disabled banner in the registry tab', async () => {
    useUIPersistentStore.setState({ platformFeaturesEnabled: false })
    vi.mocked(useUnifiedSkills).mockReturnValue({
      unifiedSkills: [
        makeSkill({
          name: 'alpha',
          description: 'Alpha skill',
          status: 'installed'
        })
      ],
      isLoading: false,
      localError: null,
      registryError: null,
      installedCount: 1
    })
    const screen = await render(<UnifiedSkillList />, { wrapper })
    await expect.element(screen.getByText('Alpha skill')).toBeInTheDocument()
    await screen.getByRole('tab', { name: 'Registry' }).click()
    await expect
      .element(
        screen.getByText(
          'Platform features are disabled. Connect to browse community skills.'
        )
      )
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('Connect to Platform'))
      .toBeInTheDocument()
  })

  it('shows the no-local-skills empty state after all local skills disappear', async () => {
    vi.mocked(useUnifiedSkills).mockReturnValue({
      unifiedSkills: [
        makeSkill({
          name: 'alpha',
          description: 'Alpha skill',
          status: 'installed'
        })
      ],
      isLoading: false,
      localError: null,
      registryError: null,
      installedCount: 1
    })
    const screen = await render(<UnifiedSkillList />, { wrapper })
    await expect.element(screen.getByText('Alpha skill')).toBeInTheDocument()
    vi.mocked(useUnifiedSkills).mockReturnValue({
      unifiedSkills: [],
      isLoading: false,
      localError: null,
      registryError: null,
      installedCount: 0
    })
    await screen.rerender(<UnifiedSkillList />)
    await expect
      .element(screen.getByText('No local skills', { exact: true }))
      .toBeInTheDocument()
  })

  it('tightens the list to search matches in the local tab', async () => {
    vi.mocked(useUnifiedSkills).mockReturnValue({
      unifiedSkills: [
        makeSkill({
          name: 'alpha',
          description: 'Alpha skill',
          status: 'installed'
        })
      ],
      isLoading: false,
      localError: null,
      registryError: null,
      installedCount: 1
    })
    const screen = await render(<UnifiedSkillList />, { wrapper })
    await screen.getByTitle('Search skills').click()
    await screen.getByPlaceholder('Search skills…').fill('nomatch')
    await expect.element(screen.getByText('Alpha skill')).toBeInTheDocument()
  })
})
