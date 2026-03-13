import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConversationItem } from '@/components/conversation/conversation-item'
import * as invoke from '@/lib/invoke'
import type { ConversationSummary } from '@/lib/invoke'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeConversation = (
  overrides: Partial<ConversationSummary> = {}
): ConversationSummary => ({
  id: 'conv-123',
  profile_id: 'prof-1',
  title: 'My Conversation',
  status: 'active',
  message_count: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-06-01T12:00:00Z',
  ...overrides
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)

beforeEach(() => {
  vi.spyOn(invoke, 'deleteConversation').mockResolvedValue(undefined)
  vi.spyOn(invoke, 'renameConversation').mockResolvedValue(undefined)
  vi.spyOn(invoke, 'listConversations').mockResolvedValue([])
})

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('ConversationItem rendering', () => {
  it('renders conversation title', () => {
    render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={false}
        onClick={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByText('My Conversation')).toBeInTheDocument()
  })

  it('renders "Untitled" when title is null', () => {
    render(
      <ConversationItem
        conversation={makeConversation({ title: null })}
        isActive={false}
        onClick={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByText('Untitled')).toBeInTheDocument()
  })

  it('renders message count', () => {
    render(
      <ConversationItem
        conversation={makeConversation({ message_count: 42 })}
        isActive={false}
        onClick={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByText(/42 msg/)).toBeInTheDocument()
  })

  it('applies active class when isActive=true', () => {
    const { container } = render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={true}
        onClick={vi.fn()}
      />,
      { wrapper }
    )
    expect(container.firstElementChild?.className).toMatch(/bg-primary/)
  })

  it('does not apply active class when isActive=false', () => {
    const { container } = render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={false}
        onClick={vi.fn()}
      />,
      { wrapper }
    )
    expect(container.firstElementChild?.className).not.toMatch(/bg-primary/)
  })
})

// ── Interaction ───────────────────────────────────────────────────────────────

describe('ConversationItem interaction', () => {
  it('calls onClick when item is clicked', () => {
    const onClick = vi.fn()
    render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={false}
        onClick={onClick}
      />,
      { wrapper }
    )
    fireEvent.click(screen.getByText('My Conversation'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('calls onClick on Enter keydown', () => {
    const onClick = vi.fn()
    const { container } = render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={false}
        onClick={onClick}
      />,
      { wrapper }
    )
    fireEvent.keyDown(container.firstElementChild!, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick on other keys', () => {
    const onClick = vi.fn()
    const { container } = render(
      <ConversationItem
        conversation={makeConversation()}
        isActive={false}
        onClick={onClick}
      />,
      { wrapper }
    )
    fireEvent.keyDown(container.firstElementChild!, { key: 'Space' })
    expect(onClick).not.toHaveBeenCalled()
  })
})
