// src/__tests__/components/thread-navigator.browser.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import ThreadNavigator from '@/components/conversation/thread-navigator'
import type { MessageData, HeadingItem } from '@/lib/bindings'

// Mock createPortal to render inline
vi.mock('react-dom', () => ({
  createPortal: (node: any) => node
}))

describe('ThreadNavigator', () => {
  const mockMessages: MessageData[] = [
    { id: '1', role: 'user', content: 'Hello', conversation_id: 'c1', created_at: '', context_items: null, metadata: null, input_tokens: null, output_tokens: null, seen: false, stable_html: null, node_document: null, status: 'complete' },
    { id: '2', role: 'assistant', content: 'Hi', conversation_id: 'c1', created_at: '', context_items: null, metadata: null, input_tokens: null, output_tokens: null, seen: false, stable_html: null, node_document: null, status: 'complete' },
    { id: '3', role: 'user', content: 'How are you?', conversation_id: 'c1', created_at: '', context_items: null, metadata: null, input_tokens: null, output_tokens: null, seen: false, stable_html: null, node_document: null, status: 'complete' },
    { id: '4', role: 'assistant', content: '# Heading\nSome text', conversation_id: 'c1', created_at: '', context_items: null, metadata: null, input_tokens: null, output_tokens: null, seen: false, stable_html: null, node_document: null, status: 'complete' },
    { id: '5', role: 'user', content: 'Thanks', conversation_id: 'c1', created_at: '', context_items: null, metadata: null, input_tokens: null, output_tokens: null, seen: false, stable_html: null, node_document: null, status: 'complete' },
  ]

  const mockHeadings: HeadingItem[] = [
    { id: 'heading-0-heading', level: 1, text: 'Heading', message_id: '4', toc_index: 0 }
  ]

  const onScrollTo = vi.fn()
  const onHeadingClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dots for all messages when there are at least 3 user messages', async () => {
    const screen = await render(
      <ThreadNavigator
        messages={mockMessages}
        onScrollTo={onScrollTo}
        activeIndex={0}
        headings={mockHeadings}
        onHeadingClick={onHeadingClick}
      />
    )
    const dots = screen.container.querySelectorAll('button')
    expect(dots.length).toBe(5) // one per message
  })

  it('does not render when less than 3 user messages', async () => {
    const fewMessages = mockMessages.slice(0, 2) // only 1 user message
    const screen = await render(
      <ThreadNavigator
        messages={fewMessages}
        onScrollTo={onScrollTo}
        activeIndex={0}
        headings={[]}
        onHeadingClick={onHeadingClick}
      />
    )
    const dots = screen.container.querySelectorAll('button')
    expect(dots.length).toBe(0)
  })

  it('shows card on hover and hides on leave', async () => {
    const screen = await render(
      <ThreadNavigator
        messages={mockMessages}
        onScrollTo={onScrollTo}
        activeIndex={0}
        headings={mockHeadings}
        onHeadingClick={onHeadingClick}
      />
    )
    const dots = screen.container.querySelectorAll('button')

    // Hover the first dot
    await dots[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))

    // Wait for the card to appear
    const card = screen.getByRole('presentation')
    expect(card).toBeTruthy()

    // Leave
    await dots[0].dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))

    // Wait for card to disappear - use element() which returns null if not found
    const cardAfterLeave = screen.getByRole('presentation').element()
    expect(cardAfterLeave).toBeNull()
  })

  it('shows preview for user messages', async () => {
    const screen = await render(
      <ThreadNavigator
        messages={mockMessages}
        onScrollTo={onScrollTo}
        activeIndex={0}
        headings={mockHeadings}
        onHeadingClick={onHeadingClick}
      />
    )
    const dots = screen.container.querySelectorAll('button')
    await dots[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))

    // Wait for preview text to appear
    const preview = screen.getByText('Hello')
    expect(preview).toBeTruthy()
  })

  it('shows preview and chevron for assistant messages with headings', async () => {
    const screen = await render(
      <ThreadNavigator
        messages={mockMessages}
        onScrollTo={onScrollTo}
        activeIndex={0}
        headings={mockHeadings}
        onHeadingClick={onHeadingClick}
      />
    )
    const dots = screen.container.querySelectorAll('button')
    // Hover the assistant message with headings (index 3)
    await dots[3].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))

    // Wait for preview text to appear
    const preview = screen.getByText('Heading')
    expect(preview).toBeTruthy()

    // Find chevron button
    const chevron = screen.getByRole('button', { name: /section/i })
    expect(chevron).toBeTruthy()
  })

  it('expands to TOC when chevron clicked', async () => {
    const screen = await render(
      <ThreadNavigator
        messages={mockMessages}
        onScrollTo={onScrollTo}
        activeIndex={0}
        headings={mockHeadings}
        onHeadingClick={onHeadingClick}
      />
    )
    const dots = screen.container.querySelectorAll('button')
    await dots[3].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))

    // Wait for chevron button
    const chevronButton = screen.getByRole('button', { name: /section/i })
    expect(chevronButton).toBeTruthy()

    // Click chevron
    await chevronButton.click()

    // Now should show heading list
    const headingItem = screen.getByText('Heading')
    expect(headingItem).toBeTruthy()
  })

  it('calls onScrollTo when dot clicked', async () => {
    const screen = await render(
      <ThreadNavigator
        messages={mockMessages}
        onScrollTo={onScrollTo}
        activeIndex={0}
        headings={mockHeadings}
        onHeadingClick={onHeadingClick}
      />
    )
    const dots = screen.container.querySelectorAll('button')
    await dots[2].click() // user message at index 2
    expect(onScrollTo).toHaveBeenCalledWith(2)
  })
})
