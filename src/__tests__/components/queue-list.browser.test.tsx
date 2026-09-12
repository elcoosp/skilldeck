// src/__tests__/components/queue-list.browser.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { QueueList } from '@/components/conversation/queue/queue-list'
import type { QueuedMessage } from '@/hooks/use-queued-messages'
import * as bindings from '@/lib/bindings'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useQueueStore } from '@/store/queue'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <TooltipProvider>{children}</TooltipProvider>
  </QueryClientProvider>
)

const makeMsg = (id: string, content: string): QueuedMessage => ({
  id,
  conversation_id: 'c1',
  content,
  position: 1,
  created_at: '2024-01-01T12:00:00Z',
  updated_at: '2024-01-01T12:00:00Z'
})

const initialState = useQueueStore.getState()

beforeEach(() => {
  useQueueStore.persist.clearStorage()
  useQueueStore.setState(initialState, true)
  localStorage.removeItem('skilldeck-queue-ui')
  vi.spyOn(bindings.commands, 'setAutoSendPaused').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.spyOn(bindings.commands, 'processQueuedMessages').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.spyOn(bindings.commands, 'reorderQueuedMessages').mockResolvedValue({
    status: 'ok',
    data: null
  })
})

describe('QueueList', () => {
  it('lists queued messages', async () => {
    vi.spyOn(bindings.commands, 'listQueuedMessages').mockResolvedValue({
      status: 'ok',
      data: [makeMsg('m1', 'do the thing'), makeMsg('m2', 'then ship')]
    })
    const screen = await render(<QueueList conversationId="c1" />, {
      wrapper
    })
    await expect.element(screen.getByText('do the thing')).toBeInTheDocument()
    await expect.element(screen.getByText('then ship')).toBeInTheDocument()
  })

  it('renders nothing when there are no messages', async () => {
    vi.spyOn(bindings.commands, 'listQueuedMessages').mockResolvedValue({
      status: 'ok',
      data: []
    })
    const screen = await render(<QueueList conversationId="c1" />, {
      wrapper
    })
    await expect.element(screen.getByText('do the thing')).not.toBeInTheDocument()
  })

  it('renders the selection toolbar in select mode', async () => {
    vi.spyOn(bindings.commands, 'listQueuedMessages').mockResolvedValue({
      status: 'ok',
      data: [makeMsg('m1', 'do the thing')]
    })
    useQueueStore.getState().setMode('c1', 'select')
    const screen = await render(<QueueList conversationId="c1" />, {
      wrapper
    })
    await expect.element(screen.getByText('do the thing')).toBeInTheDocument()
    await expect.element(
      screen.getByRole('button', { name: 'Select all' })
    ).toBeInTheDocument()
  })

  it('pauses auto-send while editing', async () => {
    vi.spyOn(bindings.commands, 'listQueuedMessages').mockResolvedValue({
      status: 'ok',
      data: [makeMsg('m1', 'do the thing')]
    })
    useQueueStore.getState().setEditingId('c1', 'm1')
    const screen = await render(<QueueList conversationId="c1" />, {
      wrapper
    })
    await expect.element(
      screen.getByText(/Auto‑send paused/)
    ).toBeInTheDocument()
    expect(bindings.commands.setAutoSendPaused).toHaveBeenCalledWith('c1', true)
  })

  it('shows the loading state', async () => {
    vi.spyOn(bindings.commands, 'listQueuedMessages').mockReturnValue(
      new Promise(() => {}) as never
    )
    const screen = await render(<QueueList conversationId="c1" />, {
      wrapper
    })
    await expect.element(screen.getByText('Loading queue...')).toBeInTheDocument()
  })
})