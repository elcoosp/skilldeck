// src/__tests__/components/suggested-prompts.browser.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SuggestedPrompts } from '@/components/conversation/suggested-prompts'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'

const initial = useUIEphemeralStore.getState()

beforeEach(() => {
  useUIEphemeralStore.setState(initial, true)
})

describe('SuggestedPrompts', () => {
  it('renders nothing when conversationId is null', async () => {
    const screen = await render(
      <SuggestedPrompts
        conversationId={null}
        hasMessages={false}
        onSelect={vi.fn()}
      />
    )
    await expect
      .element(screen.getByText('Try a prompt'))
      .not.toBeInTheDocument()
  })

  it('renders nothing once the conversation has messages', async () => {
    const screen = await render(
      <SuggestedPrompts conversationId="c1" hasMessages onSelect={vi.fn()} />
    )
    await expect
      .element(screen.getByText('Try a prompt'))
      .not.toBeInTheDocument()
  })

  it('renders six quick prompts', async () => {
    const screen = await render(
      <SuggestedPrompts
        conversationId="c1"
        hasMessages={false}
        onSelect={vi.fn()}
      />
    )
    await expect
      .element(screen.getByRole('button', { name: 'Explore more...' }))
      .toBeInTheDocument()
    const buttons = screen.container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(7)
  })

  it('calls onSelect with the full prompt text', async () => {
    const onSelect = vi.fn()
    const screen = await render(
      <SuggestedPrompts
        conversationId="c1"
        hasMessages={false}
        onSelect={onSelect}
      />
    )
    await screen.getByRole('button', { name: 'Review my code' }).click()
    expect(onSelect).toHaveBeenCalledWith(
      expect.stringContaining('Review the following code')
    )
  })

  it('dismisses permanently once the conversation has a dismissal', async () => {
    const screen = await render(
      <SuggestedPrompts
        conversationId="c1"
        hasMessages={false}
        onSelect={vi.fn()}
      />
    )
    const dismissButton = screen.container.querySelector(
      'button[class*="absolute"]'
    ) as HTMLButtonElement | null
    dismissButton?.click()
    expect(useUIEphemeralStore.getState().suggestedPromptsDismissed.c1).toBe(
      true
    )
  })

  it('renders nothing when the prompt set was dismissed earlier', async () => {
    useUIEphemeralStore.setState({ suggestedPromptsDismissed: { c1: true } })
    const screen = await render(
      <SuggestedPrompts
        conversationId="c1"
        hasMessages={false}
        onSelect={vi.fn()}
      />
    )
    await expect
      .element(screen.getByText('Try a prompt'))
      .not.toBeInTheDocument()
  })
})
