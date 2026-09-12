// src/__tests__/components/queue-item.browser.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { QueueItem } from '@/components/conversation/queue/queue-item'
import type { QueuedMessage } from '@/hooks/use-queued-messages'
import * as bindings from '@/lib/bindings'
import { useQueueStore } from '@/store/queue'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

const msg: QueuedMessage = {
  id: 'm1',
  conversation_id: 'c1',
  content: 'Remind me to fetch the data',
  position: 1,
  created_at: '2024-01-01T12:00:00Z',
  updated_at: '2024-01-01T12:00:00Z'
}

const initialState = useQueueStore.getState()

beforeEach(() => {
  useQueueStore.persist.clearStorage()
  useQueueStore.setState(initialState, true)
  localStorage.removeItem('skilldeck-queue-ui')
  vi.spyOn(bindings.commands, 'deleteQueuedMessage').mockResolvedValue({
    status: 'ok',
    data: null
  })
})

describe('QueueItem', () => {
  it('renders content and position in view mode', async () => {
    const screen = await render(
      <QueueItem message={msg} conversationId="c1" position={3} />,
      { wrapper }
    )
    await expect.element(
      screen.getByText('Remind me to fetch the data')
    ).toBeInTheDocument()
    await expect.element(screen.getByText('3', { exact: true }).first())
      .toBeInTheDocument()
  })

  it('switches to edit mode when the edit button is clicked', async () => {
    const screen = await render(
      <QueueItem message={msg} conversationId="c1" position={1} />,
      { wrapper }
    )
    const editBtn = screen.getByRole('button').nth(1)
    await editBtn.click()
    await expect.element(screen.getByText('Save')).toBeInTheDocument()
  })

  it('deletes the message when the delete button is clicked', async () => {
    const screen = await render(
      <QueueItem message={msg} conversationId="c1" position={1} />,
      { wrapper }
    )
    const deleteBtn = screen.getByRole('button').nth(2)
    await deleteBtn.click()
    expect(bindings.commands.deleteQueuedMessage).toHaveBeenCalledWith('m1')
  })

  it('shows a checked checkbox when selected in select mode', async () => {
    useQueueStore.getState().setMode('c1', 'select')
    useQueueStore.getState().toggleSelected('c1', 'm1')
    const screen = await render(
      <QueueItem message={msg} conversationId="c1" position={1} />,
      { wrapper }
    )
    const toggle = screen.getByRole('button').first()
    await toggle.click()
    expect(useQueueStore.getState().selectedIds.c1).toEqual([])
  })
})