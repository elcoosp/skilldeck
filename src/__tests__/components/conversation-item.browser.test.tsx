import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ConversationItem } from '@/components/conversation/conversation-item'
import type { ConversationSummary } from '@/lib/bindings'
import * as bindings from '@/lib/bindings'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeConversation = (
  overrides: Partial<ConversationSummary> = {}
): ConversationSummary => ({
  id: 'conv-123',
  profile_id: 'prof-1',
  title: 'My Conversation',
  workspace_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-06-01T12:00:00Z',
  message_count: '5',
  ...overrides
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)

beforeEach(() => {
  vi.spyOn(bindings.commands, 'deleteConversation').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.spyOn(bindings.commands, 'renameConversation').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.spyOn(bindings.commands, 'listConversations').mockResolvedValue({
    status: 'ok',
    data: []
  })
})

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('ConversationItem rendering', () => {
  it('renders conversation title', async () => {
    const screen = await render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={false}
        onClick={vi.fn()}
      />,
      { wrapper }
    )

    const title = screen.getByText('My Conversation')
    await expect.element(title).toBeInTheDocument()
  })

  it('renders "Untitled" when title is null', async () => {
    const screen = await render(
      <ConversationItem
        conversation={makeConversation({ title: null })}
        isActive={false}
        onClick={vi.fn()}
      />,
      { wrapper }
    )

    const title = screen.getByText('Untitled')
    await expect.element(title).toBeInTheDocument()
  })

  it('renders message count', async () => {
    const screen = await render(
      <ConversationItem
        conversation={makeConversation({ message_count: '42' })}
        isActive={false}
        onClick={vi.fn()}
      />,
      { wrapper }
    )

    const msg = screen.getByText(/42 msg/)
    await expect.element(msg).toBeInTheDocument()
  })

  it('applies active class when isActive=true', async () => {
    const screen = await render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={true}
        onClick={vi.fn()}
      />,
      { wrapper }
    )

    const item = screen.getByText('My Conversation')
    const rootElement = item.element()?.closest('[role="button"]')
    expect(rootElement?.className).toMatch(/bg-primary/)
  })

  it('does not apply active class when isActive=false', async () => {
    const screen = await render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={false}
        onClick={vi.fn()}
      />,
      { wrapper }
    )

    const item = screen.getByText('My Conversation')
    const rootElement = item.element()?.closest('[role="button"]')
    expect(rootElement?.className).not.toMatch(/bg-primary/)
  })
})

// ── Interaction ───────────────────────────────────────────────────────────────

describe('ConversationItem interaction', () => {
  it('calls onClick when item is clicked', async () => {
    const onClick = vi.fn()
    const screen = await render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={false}
        onClick={onClick}
      />,
      { wrapper }
    )

    await screen.getByText('My Conversation').click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('calls onClick on Enter keydown', async () => {
    const onClick = vi.fn()
    const screen = await render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={false}
        onClick={onClick}
      />,
      { wrapper }
    )

    const item = screen.getByText('My Conversation')
    const element = item.element()
    element?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick on other keys', async () => {
    const onClick = vi.fn()
    const screen = await render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={false}
        onClick={onClick}
      />,
      { wrapper }
    )

    const item = screen.getByText('My Conversation')
    const element = item.element()
    element?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Space', bubbles: true })
    )
    expect(onClick).not.toHaveBeenCalled()
  })
})
