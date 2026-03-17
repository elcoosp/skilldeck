import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { MessageBubble } from '@/components/conversation/message-bubble'
import type { MessageData } from '@/lib/bindings'

// ── Fixture helper ────────────────────────────────────────────────────────────

const makeMessage = (overrides: Partial<MessageData> = {}): MessageData => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  conversation_id: '123e4567-e89b-12d3-a456-426614174001',
  role: 'user',
  content: 'Hello, world!',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
})

// ── Styling ───────────────────────────────────────────────────────────────────

describe('MessageBubble styling', () => {
  it('user message bubble has primary background', async () => {
    const screen = await render(
      <MessageBubble message={makeMessage({ role: 'user' })} />
    )
    const bubble = screen.getByText('Hello, world!')
    const bubbleElement = bubble.element()
    expect(bubbleElement?.closest('div')?.className).toMatch(/bg-primary/)
  })

  it('assistant message bubble has muted background', async () => {
    const screen = await render(
      <MessageBubble message={makeMessage({ role: 'assistant' })} />
    )
    const bubble = screen.getByText('Hello, world!')
    const bubbleElement = bubble.element()
    expect(bubbleElement?.closest('div')?.className).toMatch(/bg-muted/)
  })

  it('user message container is right-aligned', async () => {
    const screen = await render(
      <MessageBubble message={makeMessage({ role: 'user' })} />
    )
    const bubble = screen.getByText('Hello, world!')
    const rootElement = bubble.element()?.closest('.flex')
    expect(rootElement?.className).toMatch(/flex-row-reverse/)
  })

  it('assistant message container is left-aligned', async () => {
    const screen = await render(
      <MessageBubble message={makeMessage({ role: 'assistant' })} />
    )
    const bubble = screen.getByText('Hello, world!')
    const rootElement = bubble.element()?.closest('.flex')
    expect(rootElement?.className).not.toMatch(/flex-row-reverse/)
  })
})

// ── Avatars ───────────────────────────────────────────────────────────────────

describe('MessageBubble avatars', () => {
  it('renders an avatar for user messages', async () => {
    const screen = await render(
      <MessageBubble message={makeMessage({ role: 'user' })} />
    )
    const avatar = screen.getByLabelText('User avatar') // assume aria-label is set
    await expect.element(avatar).toBeInTheDocument()
  })

  it('renders an avatar for assistant messages', async () => {
    const screen = await render(
      <MessageBubble message={makeMessage({ role: 'assistant' })} />
    )
    const avatar = screen.getByLabelText('Assistant avatar')
    await expect.element(avatar).toBeInTheDocument()
  })

  it('user avatar has primary background', async () => {
    const screen = await render(
      <MessageBubble message={makeMessage({ role: 'user' })} />
    )
    const avatar = screen.getByLabelText('User avatar')
    expect(avatar.element()?.className).toMatch(/bg-primary/)
  })

  it('assistant avatar has muted background', async () => {
    const screen = await render(
      <MessageBubble message={makeMessage({ role: 'assistant' })} />
    )
    const avatar = screen.getByLabelText('Assistant avatar')
    expect(avatar.element()?.className).toMatch(/bg-muted/)
  })
})

// ── Content ───────────────────────────────────────────────────────────────────

describe('MessageBubble content', () => {
  it('renders message content', async () => {
    const screen = await render(
      <MessageBubble message={makeMessage({ content: 'Test content' })} />
    )
    const content = screen.getByText('Test content')
    await expect.element(content).toBeInTheDocument()
  })

  it('renders multiline content with whitespace preserved', async () => {
    const content = 'line one\nline two'
    const screen = await render(
      <MessageBubble message={makeMessage({ role: 'user', content })} />
    )
    const rendered = screen.getByText(content)
    await expect.element(rendered).toBeInTheDocument()
  })

  it('shows streaming spinner when isStreaming=true on assistant message', async () => {
    const screen = await render(
      <MessageBubble
        message={makeMessage({ role: 'assistant', content: 'Partial…' })}
        isStreaming
      />
    )
    const spinner = screen.getByRole('status', { name: /loading/i }) // assume spinner has role="status"
    await expect.element(spinner).toBeInTheDocument()
  })

  it('does not show spinner when isStreaming=false', async () => {
    const screen = await render(
      <MessageBubble
        message={makeMessage({ role: 'assistant', content: 'Done' })}
        isStreaming={false}
      />
    )
    const spinner = screen.getByRole('status', { name: /loading/i }).query()
    expect(spinner).toBeNull()
  })
})

// ── Role variants ─────────────────────────────────────────────────────────────

describe('MessageBubble role variants', () => {
  it('tool role renders with monospace class', async () => {
    const screen = await render(
      <MessageBubble
        message={makeMessage({ role: 'tool', content: '{"result": "ok"}' })}
      />
    )
    const bubble = screen.getByText(/{"result"/)
    expect(bubble.element()?.className).toMatch(/font-mono/)
  })

  it('system role renders with destructive avatar colouring', async () => {
    const screen = await render(
      <MessageBubble
        message={makeMessage({ role: 'system', content: 'System notice' })}
      />
    )
    const avatar = screen.getByLabelText('System avatar')
    expect(avatar.element()?.className).toMatch(/destructive/)
  })
})
