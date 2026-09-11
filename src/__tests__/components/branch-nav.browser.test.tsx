// src/__tests__/components/branch-nav.browser.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { BranchNav } from '@/components/conversation/branch-nav'
import * as bindings from '@/lib/bindings'
import { useConversationStore } from '@/store/conversation'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)

const branch = (id: string, name: string | null) => ({
  id,
  name,
  parent_message_id: 'm1',
  created_at: '2026-01-01T00:00:00Z',
  message_count: 3
})

const branches = [branch('b1', 'fix bug'), branch('b2', 'add tests')]

const initialStore = useConversationStore.getState()

beforeEach(() => {
  useConversationStore.setState(initialStore, true)
  vi.spyOn(bindings.commands, 'listBranches').mockResolvedValue({
    status: 'ok',
    data: branches
  })
})

describe('BranchNav', () => {
  it('renders nothing while loading or when empty', async () => {
    vi.spyOn(bindings.commands, 'listBranches').mockResolvedValue({
      status: 'ok',
      data: []
    })
    const screen = await render(<BranchNav conversationId="c1" />, { wrapper })
    await expect
      .element(screen.getByText('Main', { exact: false }))
      .not.toBeInTheDocument()
  })

  it('renders the main indicator with a count when on main', async () => {
    const screen = await render(<BranchNav conversationId="c1" />, { wrapper })
    await expect.element(screen.getByText('(2)')).toBeInTheDocument()
    await expect.element(screen.getByText('Main')).toBeInTheDocument()
  })

  it('disables the previous arrow when on main', async () => {
    const screen = await render(<BranchNav conversationId="c1" />, { wrapper })
    const prev = screen.getByRole('button', { name: 'Previous branch' })
    await expect.element(prev).toBeDisabled()
  })

  it('moves to the first branch via next and shows the index', async () => {
    const screen = await render(<BranchNav conversationId="c1" />, { wrapper })
    await screen.getByRole('button', { name: 'Next branch' }).click()
    await expect.element(screen.getByText('1 / 2')).toBeInTheDocument()
    await expect.element(screen.getByText('fix bug')).toBeInTheDocument()
    expect(useConversationStore.getState().activeBranchId).toBe('b1')
  })

  it('disables the previous arrow on the first branch', async () => {
    useConversationStore.setState({ activeBranchId: 'b1' })
    const screen = await render(<BranchNav conversationId="c1" />, { wrapper })
    const prev = screen.getByRole('button', { name: 'Previous branch' })
    await expect.element(prev).toBeDisabled()
    expect(useConversationStore.getState().activeBranchId).toBe('b1')
  })

  it('moves forward to the next branch from a branch', async () => {
    useConversationStore.setState({ activeBranchId: 'b1' })
    const screen = await render(<BranchNav conversationId="c1" />, { wrapper })
    await screen.getByRole('button', { name: 'Next branch' }).click()
    await expect.element(screen.getByText('2 / 2')).toBeInTheDocument()
    await expect.element(screen.getByText('add tests')).toBeInTheDocument()
    expect(useConversationStore.getState().activeBranchId).toBe('b2')
  })

  it('disables the next arrow on the last branch', async () => {
    useConversationStore.setState({ activeBranchId: 'b2' })
    const screen = await render(<BranchNav conversationId="c1" />, { wrapper })
    const next = screen.getByRole('button', { name: 'Next branch' })
    await expect.element(next).toBeDisabled()
  })

  it('exits a branch via the exit button', async () => {
    useConversationStore.setState({ activeBranchId: 'b1' })
    const screen = await render(<BranchNav conversationId="c1" />, { wrapper })
    await screen.getByRole('button', { name: 'Exit branch' }).click()
    await expect.element(screen.getByText('Main')).toBeInTheDocument()
    expect(useConversationStore.getState().activeBranchId).toBeNull()
  })
})
