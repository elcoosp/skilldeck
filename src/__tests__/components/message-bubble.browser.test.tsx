// src/__tests__/components/message-bubble.browser.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { MessageBubble } from '@/components/conversation/message-bubble'
import type { MessageData } from '@/lib/bindings'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

const wrap = (element: React.ReactNode) => (
  <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
)

// ── Fixture helper ────────────────────────────────────────────────────────────

const makeMessage = (overrides: Partial<MessageData> = {}): MessageData => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  conversation_id: '123e4567-e89b-12d3-a456-426614174001',
  role: 'user',
  content: 'Hello, world!',
  created_at: '2024-01-01T00:00:00Z',
  context_items: null,
  metadata: null,
  input_tokens: null,
  output_tokens: null,
  seen: false,
  node_document: null,
  status: 'complete',
  ...overrides
})

// ── Styling ───────────────────────────────────────────────────────────────────

describe('MessageBubble styling', () => {
  it('user message bubble has primary background', async () => {
    const screen = await render(
      wrap(<MessageBubble message={makeMessage({ role: 'user' })} />)
    )
    const bubble = screen.getByText('Hello, world!')
    const bubbleElement = bubble.element()
    expect(bubbleElement?.closest('div')?.className).toMatch(/bg-primary/)
  })

  it('assistant message shows a role label in a transparent bubble', async () => {
    const screen = await render(
      wrap(<MessageBubble message={makeMessage({ role: 'assistant' })} />)
    )
    await expect.element(screen.getByText('Assistant')).toBeInTheDocument()
    const bubble = screen.getByText('Hello, world!')
    expect(bubble.element()?.closest('div')?.className).not.toMatch(
      /bg-primary/
    )
  })

  it('user message container is right-aligned', async () => {
    const screen = await render(
      wrap(<MessageBubble message={makeMessage({ role: 'user' })} />)
    )
    const rootElement = screen.container.querySelector('[id^="msg-"]')
    expect(rootElement?.className).toMatch(/flex-row-reverse/)
  })

  it('assistant message container is left-aligned', async () => {
    const screen = await render(
      wrap(<MessageBubble message={makeMessage({ role: 'assistant' })} />)
    )
    const rootElement = screen.container.querySelector('[id^="msg-"]')
    expect(rootElement?.className).not.toMatch(/flex-row-reverse/)
  })
})

// ── Avatars ───────────────────────────────────────────────────────────────────

describe('MessageBubble avatars', () => {
  it('renders an avatar for user messages', async () => {
    const screen = await render(
      wrap(<MessageBubble message={makeMessage({ role: 'user' })} />)
    )
    const avatar = screen.container.querySelector('.size-7.rounded-full')
    expect(avatar).not.toBeNull()
  })

  it('renders an avatar for assistant messages', async () => {
    const screen = await render(
      wrap(<MessageBubble message={makeMessage({ role: 'assistant' })} />)
    )
    const avatar = screen.container.querySelector('.size-7.rounded-full')
    expect(avatar).not.toBeNull()
  })

  it('user avatar has primary background', async () => {
    const screen = await render(
      wrap(<MessageBubble message={makeMessage({ role: 'user' })} />)
    )
    const avatar = screen.container.querySelector('.size-7.rounded-full')
    expect(avatar?.className).toMatch(/bg-primary/)
  })

  it('assistant avatar has muted background', async () => {
    const screen = await render(
      wrap(<MessageBubble message={makeMessage({ role: 'assistant' })} />)
    )
    const avatar = screen.container.querySelector('.size-7.rounded-full')
    expect(avatar?.className).toMatch(/bg-muted/)
  })
})

// ── Content ───────────────────────────────────────────────────────────────────

describe('MessageBubble content', () => {
  it('renders message content', async () => {
    const screen = await render(
      wrap(<MessageBubble message={makeMessage({ content: 'Test content' })} />)
    )
    const content = screen.getByText('Test content')
    await expect.element(content).toBeInTheDocument()
  })

  it('renders multiline content with whitespace preserved', async () => {
    const content = 'line one\nline two'
    const screen = await render(
      wrap(<MessageBubble message={makeMessage({ role: 'user', content })} />)
    )
    const rendered = screen.getByText(content)
    await expect.element(rendered).toBeInTheDocument()
  })

  it('renders markdown content while streaming without a status spinner', async () => {
    const screen = await render(
      wrap(
        <MessageBubble
          message={makeMessage({ role: 'assistant', content: 'Partial…' })}
          isStreaming
        />
      )
    )
    const content = screen.getByText('Partial…')
    await expect.element(content).toBeInTheDocument()
    expect(content.element()?.closest('.prose')).not.toBeNull()
    const spinner = screen.getByRole('status', { name: /loading/i }).query()
    expect(spinner).toBeNull()
  })

  it('does not show spinner when isStreaming=false', async () => {
    const screen = await render(
      wrap(
        <MessageBubble
          message={makeMessage({ role: 'assistant', content: 'Done' })}
          isStreaming={false}
        />
      )
    )
    const spinner = screen.getByRole('status', { name: /loading/i }).query()
    expect(spinner).toBeNull()
  })
})

// ── Role variants ─────────────────────────────────────────────────────────────

describe('MessageBubble role variants', () => {
  it('tool role renders a collapsible result card', async () => {
    const screen = await render(
      wrap(
        <MessageBubble
          message={makeMessage({ role: 'tool', content: '{"result": "ok"}' })}
        />
      )
    )
    const header = screen.getByText('Tool result')
    await expect.element(header).toBeInTheDocument()
    expect(header.element()?.closest('.font-mono')).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Expand' }).query()
    ).not.toBeNull()
    expect(screen.getByText(/"result": "ok"/).query()).toBeNull()
  })

  it('tool role expands to reveal the result content', async () => {
    const screen = await render(
      wrap(
        <MessageBubble
          message={makeMessage({ role: 'tool', content: '{"result": "ok"}' })}
        />
      )
    )
    await screen.getByRole('button', { name: 'Expand' }).click()
    await expect.element(screen.getByText(/"result": "ok"/)).toBeInTheDocument()
  })

  it('system role renders with blue avatar coloring', async () => {
    const screen = await render(
      wrap(
        <MessageBubble
          message={makeMessage({ role: 'system', content: 'System notice' })}
        />
      )
    )
    const avatar = screen.container.querySelector('.size-7.rounded-full')
    expect(avatar?.className).toMatch(/bg-blue-500/)
  })
})
