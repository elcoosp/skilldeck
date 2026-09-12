// src/__tests__/components/heading.browser.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { Heading } from '@/components/conversation/heading'
import * as bindings from '@/lib/bindings'
import { useConversationStore } from '@/store/conversation'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)

const bookmark = {
  id: 'bm1',
  message_id: 'm1',
  heading_anchor: 'overview',
  label: 'Overview',
  created_at: '2026-01-01T00:00:00Z'
}

const initialStore = useConversationStore.getState()

beforeEach(() => {
  useConversationStore.setState(initialStore, true)
  vi.spyOn(bindings.commands, 'listBookmarks').mockResolvedValue({
    status: 'ok',
    data: []
  })
  vi.spyOn(bindings.commands, 'toggleBookmark').mockResolvedValue({
    status: 'ok',
    data: null
  })
  vi.clearAllMocks()
})

describe('Heading', () => {
  it('renders the heading text at the requested level with an anchor', async () => {
    useConversationStore.setState({ activeConversationId: 'c1' })
    const screen = await render(
      <Heading level={2} slug="overview" text="Overview" />,
      { wrapper }
    )
    const heading = screen.container.querySelector(
      'h2#overview'
    ) as HTMLElement | null
    expect(heading).not.toBeNull()
    await expect.element(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('marks the bookmark button active when the slug matches a bookmark', async () => {
    useConversationStore.setState({ activeConversationId: 'c1' })
    vi.spyOn(bindings.commands, 'listBookmarks').mockResolvedValue({
      status: 'ok',
      data: [bookmark]
    })
    const screen = await render(
      <Heading level={3} slug="overview" text="Details" />,
      { wrapper }
    )
    const button = screen.container.querySelector(
      'button'
    ) as HTMLButtonElement | null
    expect(button).not.toBeNull()
    await vi.waitFor(() =>
      expect(
        screen.container.querySelector('svg[class*="amber"]')
      ).not.toBeNull()
    )
  })

  it('toggles a bookmark through the toggleBookmark command', async () => {
    useConversationStore.setState({ activeConversationId: 'c1' })
    const toggle = vi
      .spyOn(bindings.commands, 'toggleBookmark')
      .mockResolvedValue({
        status: 'ok',
        data: null
      })
    const screen = await render(
      <Heading level={2} slug="overview" text="Overview" messageId="m9" />,
      { wrapper }
    )
    const button = screen.container.querySelector(
      'button'
    ) as HTMLButtonElement | null
    button?.click()
    await vi.waitFor(() => expect(toggle).toHaveBeenCalled())
    expect(toggle).toHaveBeenCalledWith('c1', 'm9', 'overview', 'Overview')
  })
})
