// src/__tests__/components/queue-pause-indicator.browser.test.tsx
import { beforeEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { QueuePauseIndicator } from '@/components/conversation/queue/queue-pause-indicator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useQueueStore } from '@/store/queue'

const CONV = 'c1'
const initialState = useQueueStore.getState()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>{children}</TooltipProvider>
)

beforeEach(() => {
  useQueueStore.persist.clearStorage()
  useQueueStore.setState(initialState, true)
})

describe('QueuePauseIndicator', () => {
  it('renders when editing', async () => {
    useQueueStore.getState().setEditingId(CONV, 'm1')
    const screen = await render(
      <QueuePauseIndicator conversationId={CONV} />,
      { wrapper }
    )
    await expect.element(
      screen.getByText(/Auto‑send paused/)
    ).toBeInTheDocument()
  })

  it('renders when dragging', async () => {
    useQueueStore.getState().setIsDragging(CONV, true)
    const screen = await render(
      <QueuePauseIndicator conversationId={CONV} />,
      { wrapper }
    )
    await expect.element(
      screen.getByText(/Auto‑send paused/)
    ).toBeInTheDocument()
  })

  it('renders when in select mode', async () => {
    useQueueStore.getState().setMode(CONV, 'select')
    const screen = await render(
      <QueuePauseIndicator conversationId={CONV} />,
      { wrapper }
    )
    await expect.element(
      screen.getByText(/Auto‑send paused/)
    ).toBeInTheDocument()
  })
})
