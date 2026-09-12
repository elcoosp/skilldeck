// src/__tests__/components/queue-edit-form.browser.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { QueueEditForm } from '@/components/conversation/queue/queue-edit-form'
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
  vi.spyOn(bindings.commands, 'updateQueuedMessage').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.mocked(bindings.commands.updateQueuedMessage).mockClear()
})

describe('QueueEditForm', () => {
  it('renders the initial content', async () => {
    const screen = await render(
      <QueueEditForm
        conversationId="c1"
        messageId="m1"
        initialContent="fix this"
        onCancel={vi.fn()}
      />,
      { wrapper }
    )
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeTruthy()
    await expect.element(textarea).toHaveValue('fix this')
  })

  it('saves updated content on submit', async () => {
    const onCancel = vi.fn()
    const screen = await render(
      <QueueEditForm
        conversationId="c1"
        messageId="m1"
        initialContent="old"
        onCancel={onCancel}
      />,
      { wrapper }
    )
    const textarea = screen.getByRole('textbox')
    await textarea.fill('new content')
    await screen.getByRole('button', { name: 'Save' }).click()
    expect(bindings.commands.updateQueuedMessage).toHaveBeenCalledWith(
      'm1',
      'new content'
    )
    expect(onCancel).toHaveBeenCalled()
  })

  it('disables save when content is blank', async () => {
    const screen = await render(
      <QueueEditForm
        conversationId="c1"
        messageId="m1"
        initialContent="   "
        onCancel={vi.fn()}
      />,
      { wrapper }
    )
    const save = screen.getByRole('button', { name: 'Save' })
    await expect.element(save).toBeDisabled()
  })

  it('cancels without saving', async () => {
    const onCancel = vi.fn()
    const screen = await render(
      <QueueEditForm
        conversationId="c1"
        messageId="m1"
        initialContent="old"
        onCancel={onCancel}
      />,
      { wrapper }
    )
    await screen.getByRole('button', { name: 'Cancel' }).click()
    expect(bindings.commands.updateQueuedMessage).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })
})