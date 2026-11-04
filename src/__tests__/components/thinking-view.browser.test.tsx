// src/__tests__/components/thinking-view.browser.test.tsx
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { ThinkingView } from '@/components/conversation/thinking-view'
import type { NodeDocument } from '@/lib/bindings'

const simpleDoc: NodeDocument = {
  stable_nodes: [
    {
      id: 'p1',
      type: 'paragraph',
      html: 'First, gather the facts.'
    }
  ],
  draft_nodes: [],
  toc_items: [],
  artifact_specs: []
}

describe('ThinkingView', () => {
  it('renders nothing when the document is null', async () => {
    const screen = await render(
      <ThinkingView document={null} messageId="m1" conversationId="c1" />
    )
    await expect
      .element(screen.getByText('Thought process'))
      .not.toBeInTheDocument()
  })

  it('renders nothing when the document has no content', async () => {
    const screen = await render(
      <ThinkingView
        document={{
          stable_nodes: [],
          draft_nodes: [],
          toc_items: [],
          artifact_specs: []
        }}
        messageId="m1"
        conversationId="c1"
      />
    )
    await expect
      .element(screen.getByText('Thought process'))
      .not.toBeInTheDocument()
  })

  it('is collapsed by default and expands on click', async () => {
    const screen = await render(
      <ThinkingView document={simpleDoc} messageId="m1" conversationId="c1" />
    )
    const toggle = screen.getByRole('button', {
      name: 'Toggle thought process'
    })
    expect(toggle.element().getAttribute('aria-expanded')).toBe('false')
    await expect
      .element(screen.getByText('First, gather the facts.'))
      .not.toBeInTheDocument()
    await toggle.click()
    await expect
      .element(screen.getByText('First, gather the facts.'))
      .toBeInTheDocument()
  })

  it('is expanded by default while streaming', async () => {
    const screen = await render(
      <ThinkingView
        document={simpleDoc}
        messageId="m1"
        conversationId="c1"
        isStreaming
      />
    )
    await expect.element(screen.getByText('Thinking…')).toBeInTheDocument()
    await expect
      .element(screen.getByText('First, gather the facts.'))
      .toBeInTheDocument()
  })

  it('shows streaming thinking label and a pulsing indicator', async () => {
    const screen = await render(
      <ThinkingView
        document={simpleDoc}
        messageId="m1"
        conversationId="c1"
        isStreaming
      />
    )
    const indicator = screen.container.querySelector('[class*="animate-pulse"]')
    expect(indicator).not.toBeNull()
    await expect.element(screen.getByText('Thinking…')).toBeInTheDocument()
  })
})
