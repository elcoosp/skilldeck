import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MessageBubble } from '@/components/conversation/message-bubble'
import type { Message } from '@/lib/invoke'

// ── Fixture helper ────────────────────────────────────────────────────────────

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  conversation_id: '123e4567-e89b-12d3-a456-426614174001',
  role: 'user',
  content: 'Hello, world!',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
})

// ── Styling ───────────────────────────────────────────────────────────────────

describe('MessageBubble styling', () => {
  it('user message bubble has primary background', () => {
    render(<MessageBubble message={makeMessage({ role: 'user' })} />)
    const bubble = screen.getByText('Hello, world!').closest('div')
    expect(bubble).toHaveClass('bg-primary')
  })

  it('assistant message bubble has muted background', () => {
    render(<MessageBubble message={makeMessage({ role: 'assistant' })} />)
    const bubble = screen.getByText('Hello, world!').closest('div')
    expect(bubble).toHaveClass('bg-muted')
  })

  it('user message container is right-aligned', () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: 'user' })} />
    )
    const root = container.firstElementChild
    expect(root).toHaveClass('flex-row-reverse')
  })

  it('assistant message container is left-aligned (no flex-row-reverse)', () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: 'assistant' })} />
    )
    const root = container.firstElementChild
    expect(root).not.toHaveClass('flex-row-reverse')
  })
})

// ── Avatars ───────────────────────────────────────────────────────────────────

describe('MessageBubble avatars', () => {
  it('renders an avatar for user messages', () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: 'user' })} />
    )
    // The avatar div always exists
    const avatarDiv = container.querySelector('[aria-hidden="true"]')
    expect(avatarDiv).toBeInTheDocument()
  })

  it('renders an avatar for assistant messages', () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: 'assistant' })} />
    )
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('user avatar has primary background', () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: 'user' })} />
    )
    const avatar = container.querySelector('[aria-hidden="true"]')
    expect(avatar).toHaveClass('bg-primary')
  })

  it('assistant avatar has muted background', () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: 'assistant' })} />
    )
    const avatar = container.querySelector('[aria-hidden="true"]')
    expect(avatar).toHaveClass('bg-muted')
  })
})

// ── Content ───────────────────────────────────────────────────────────────────

describe('MessageBubble content', () => {
  it('renders message content', () => {
    render(<MessageBubble message={makeMessage({ content: 'Test content' })} />)
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('renders multiline user content with whitespace preserved', () => {
    const content = 'line one\nline two'
    render(<MessageBubble message={makeMessage({ role: 'user', content })} />)
    expect(screen.getByText(content)).toBeInTheDocument()
  })

  it('shows streaming spinner when isStreaming=true on assistant message', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({ role: 'assistant', content: 'Partial…' })}
        isStreaming
      />
    )
    // Loader2 icon renders as an svg inside the bubble
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument()
  })

  it('does not show spinner when isStreaming=false', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({ role: 'assistant', content: 'Done' })}
        isStreaming={false}
      />
    )
    expect(container.querySelector('svg.animate-spin')).toBeNull()
  })

  it('streaming synthetic message shows spinner', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({
          id: '__streaming__',
          role: 'assistant',
          content: '▊'
        })}
      />
    )
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument()
  })
})

// ── Role variants ─────────────────────────────────────────────────────────────

describe('MessageBubble role variants', () => {
  it('tool role renders with monospace class', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({ role: 'tool', content: '{"result": "ok"}' })}
      />
    )
    const bubble = container.querySelector('.font-mono')
    expect(bubble).toBeInTheDocument()
  })

  it('system role renders with destructive avatar colouring', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({ role: 'system', content: 'System notice' })}
      />
    )
    const avatar = container.querySelector('[aria-hidden="true"]')
    expect(avatar?.className).toMatch(/destructive/)
  })
})
