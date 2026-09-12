// src/__tests__/components/queue-selection-toolbar.browser.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { QueueSelectionToolbar } from '@/components/conversation/queue/queue-selection-toolbar'
import * as bindings from '@/lib/bindings'
import { useQueueStore } from '@/store/queue'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

const initialState = useQueueStore.getState()

beforeEach(() => {
  useQueueStore.persist.clearStorage()
  useQueueStore.setState(initialState, true)
  localStorage.removeItem('skilldeck-queue-ui')
  vi.spyOn(bindings.commands, 'deleteQueuedMessage').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.spyOn(bindings.commands, 'mergeQueuedMessages').mockResolvedValue({
    status: 'ok',
    data: 'merged-id'
  })
})

describe('QueueSelectionToolbar', () => {
  it('select all selects every message', async () => {
    const screen = await render(
      <QueueSelectionToolbar conversationId="c1" messageIds={['m1', 'm2']} />,
      { wrapper }
    )
    await expect.element(screen.getByText('0 selected')).not.toBeInTheDocument()
    await screen.getByRole('button', { name: 'Select all' }).click()
    expect(useQueueStore.getState().selectedIds.c1).toEqual(['m1', 'm2'])
  })

  it('select all when all selected clears the selection', async () => {
    useQueueStore.getState().selectAll('c1', ['m1', 'm2'])
    const screen = await render(
      <QueueSelectionToolbar conversationId="c1" messageIds={['m1', 'm2']} />,
      { wrapper }
    )
    await screen.getByRole('button', { name: 'Select all' }).click()
    expect(useQueueStore.getState().selectedIds.c1).toEqual([])
  })

  it('delete is disabled with no selection', async () => {
    const screen = await render(
      <QueueSelectionToolbar conversationId="c1" messageIds={['m1']} />,
      { wrapper }
    )
    await expect.element(
      screen.getByRole('button', { name: 'Delete' })
    ).toBeDisabled()
  })

  it('deletes each selected message', async () => {
    useQueueStore.getState().selectAll('c1', ['m1', 'm2'])
    const screen = await render(
      <QueueSelectionToolbar conversationId="c1" messageIds={['m1', 'm2']} />,
      { wrapper }
    )
    await screen.getByRole('button', { name: 'Delete' }).click()
    expect(bindings.commands.deleteQueuedMessage).toHaveBeenCalledWith('m1')
    expect(bindings.commands.deleteQueuedMessage).toHaveBeenCalledWith('m2')
    expect(useQueueStore.getState().selectedIds.c1).toEqual([])
  })

  it('merge is disabled with fewer than two selections', async () => {
    useQueueStore.getState().toggleSelected('c1', 'm1')
    const screen = await render(
      <QueueSelectionToolbar conversationId="c1" messageIds={['m1', 'm2']} />,
      { wrapper }
    )
    await expect.element(
      screen.getByRole('button', { name: 'Merge' })
    ).toBeDisabled()
  })

  it('merges selected messages and returns to view mode', async () => {
    useQueueStore.getState().selectAll('c1', ['m1', 'm2'])
    const screen = await render(
      <QueueSelectionToolbar conversationId="c1" messageIds={['m1', 'm2']} />,
      { wrapper }
    )
    await screen.getByRole('button', { name: 'Merge' }).click()
    expect(bindings.commands.mergeQueuedMessages).toHaveBeenCalledWith([
      'm1',
      'm2'
    ])
    expect(useQueueStore.getState().selectedIds.c1).toEqual([])
    expect(useQueueStore.getState().mode.c1).toBe('view')
  })
})