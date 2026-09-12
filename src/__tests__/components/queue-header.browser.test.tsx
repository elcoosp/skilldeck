// src/__tests__/components/queue-header.browser.test.tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { QueueHeader } from '@/components/conversation/queue/queue-header'
import type { QueuedMessage } from '@/hooks/use-queued-messages'
import { useQueueStore } from '@/store/queue'

const CONV = 'c1'
const initialState = useQueueStore.getState()

const makeMsg = (id: string, content: string): QueuedMessage => ({
  id,
  conversation_id: CONV,
  content,
  position: 1,
  created_at: '2024-01-01T12:00:00Z',
  updated_at: '2024-01-01T12:00:00Z'
})

beforeEach(() => {
  useQueueStore.persist.clearStorage()
  useQueueStore.setState(initialState, true)
  localStorage.removeItem('skilldeck-queue-ui')
})

describe('QueueHeader', () => {
  it('does not render when there are no messages', async () => {
    const screen = await render(
      <QueueHeader conversationId={CONV} messages={[]} />
    )
    await expect.element(screen.getByText('Queued')).not.toBeInTheDocument()
  })

  it('renders the message count', async () => {
    const msgs = [makeMsg('m1', 'hello'), makeMsg('m2', 'world')]
    const screen = await render(
      <QueueHeader conversationId={CONV} messages={msgs} />
    )
    await expect.element(screen.getByText('Queued')).toBeInTheDocument()
    await expect.element(screen.getByText('2')).toBeInTheDocument()
  })

  it('toggles expanded on click', async () => {
    const msgs = [makeMsg('m1', 'hello')]
    const screen = await render(
      <QueueHeader conversationId={CONV} messages={msgs} />
    )
    const btn = screen.getByRole('button', { name: /Queued/ })
    await btn.click()
    expect(useQueueStore.getState().expanded.c1).toBe(true)
    await btn.click()
    expect(useQueueStore.getState().expanded.c1).toBe(false)
  })

  it('switches to select mode', async () => {
    const msgs = [makeMsg('m1', 'hello')]
    const screen = await render(
      <QueueHeader conversationId={CONV} messages={msgs} />
    )
    await screen.getByRole('button', { name: 'Select' }).click()
    expect(useQueueStore.getState().mode.c1).toBe('select')
    await expect.element(screen.getByText('0 selected')).toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: 'Cancel' }))
      .toBeInTheDocument()
  })

  it('cancel exits select mode', async () => {
    const msgs = [makeMsg('m1', 'hello')]
    useQueueStore.getState().setMode(CONV, 'select')
    useQueueStore.getState().toggleSelected(CONV, 'm1')
    const screen = await render(
      <QueueHeader conversationId={CONV} messages={msgs} />
    )
    await expect.element(screen.getByText('1 selected')).toBeInTheDocument()
    await screen.getByRole('button', { name: 'Cancel' }).click()
    expect(useQueueStore.getState().mode.c1).toBe('view')
    expect(useQueueStore.getState().selectedIds.c1).toEqual([])
  })
})
