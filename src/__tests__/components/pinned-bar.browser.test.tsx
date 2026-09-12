// src/__tests__/components/pinned-bar.browser.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { PinnedBar } from '@/components/conversation/pinned-bar'
import * as bindings from '@/lib/bindings'
import { useConversationStore } from '@/store/conversation'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)

const artifact = {
  id: 'a1',
  message_id: 'm1',
  branch_id: null,
  type: 'code',
  name: 'Main.tsx',
  content: 'export const x = 1',
  language: 'tsx',
  logical_key: null,
  file_path: null,
  created_at: '2026-01-01T00:00:00Z'
}

const initialStore = useConversationStore.getState()

beforeEach(() => {
  useConversationStore.setState(initialStore, true)
  vi.spyOn(bindings.commands, 'listPinnedArtifacts').mockResolvedValue({
    status: 'ok',
    data: []
  })
})

describe('PinnedBar', () => {
  it('renders nothing when there are no pins', async () => {
    const screen = await render(<PinnedBar />, { wrapper })
    await expect.element(screen.getByText('Main.tsx')).not.toBeInTheDocument()
  })

  it('renders pinned artifacts for the active conversation', async () => {
    useConversationStore.setState({ activeConversationId: 'c1' })
    vi.spyOn(bindings.commands, 'listPinnedArtifacts').mockResolvedValue({
      status: 'ok',
      data: [artifact]
    })
    const screen = await render(<PinnedBar />, { wrapper })
    await expect.element(screen.getByText('Main.tsx')).toBeInTheDocument()
  })

  it('queries global pins with a null branch', async () => {
    useConversationStore.setState({ activeConversationId: 'c1' })
    const spy = vi
      .spyOn(bindings.commands, 'listPinnedArtifacts')
      .mockResolvedValue({
        status: 'ok',
        data: []
      })
    await render(<PinnedBar />, { wrapper })
    await vi.waitFor(() => expect(spy).toHaveBeenCalledWith('c1', null))
  })

  it('queries branch pins when an active branch is set', async () => {
    useConversationStore.setState({
      activeConversationId: 'c1',
      activeBranchId: 'b1'
    })
    const spy = vi
      .spyOn(bindings.commands, 'listPinnedArtifacts')
      .mockResolvedValue({
        status: 'ok',
        data: [artifact]
      })
    await render(<PinnedBar />, { wrapper })
    await vi.waitFor(() => expect(spy).toHaveBeenCalledWith('c1', 'b1'))
  })
})
