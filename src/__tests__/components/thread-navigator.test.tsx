// src/__tests__/components/thread-navigator.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThreadNavigator from '@/components/conversation/thread-navigator'
import type { HeadingItem, MessageData } from '@/lib/bindings'

// Mock createPortal to render inline
vi.mock('react-dom', async (importOriginal) => {
  const reactDom = await importOriginal<typeof import('react-dom')>()
  return {
    ...reactDom,
    createPortal: (node: React.ReactNode) => node
  }
})

// Mock framer-motion so Web Animations API exit animations don't emit
// unhandled "animation canceled" rejections on unmount; card unmounts instantly.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: new Proxy(
      {},
      {
        get: (_target, prop) =>
          typeof prop === 'string' && /^[a-z]/.test(prop) ? 'div' : undefined
      }
    )
  }
})

// Bookmarks hooks hit Tauri IPC; not the focus here
vi.mock('@/hooks/use-bookmarks', () => ({
  useBookmarks: () => ({ data: [] }),
  useToggleBookmark: () => vi.fn()
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

const wrap = (element: React.ReactNode) => (
  <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
)

const mockMessages: MessageData[] = [
  {
    id: '1',
    role: 'user',
    content: 'Hello',
    conversation_id: 'c1',
    created_at: '',
    context_items: null,
    metadata: null,
    input_tokens: null,
    output_tokens: null,
    seen: false,
    node_document: null,
    status: 'complete'
  },
  {
    id: '2',
    role: 'assistant',
    content: 'Hi',
    conversation_id: 'c1',
    created_at: '',
    context_items: null,
    metadata: null,
    input_tokens: null,
    output_tokens: null,
    seen: false,
    node_document: null,
    status: 'complete'
  },
  {
    id: '3',
    role: 'user',
    content: 'How are you?',
    conversation_id: 'c1',
    created_at: '',
    context_items: null,
    metadata: null,
    input_tokens: null,
    output_tokens: null,
    seen: false,
    node_document: null,
    status: 'complete'
  },
  {
    id: '4',
    role: 'assistant',
    content: '# Heading\nSome text',
    conversation_id: 'c1',
    created_at: '',
    context_items: null,
    metadata: null,
    input_tokens: null,
    output_tokens: null,
    seen: false,
    node_document: null,
    status: 'complete'
  },
  {
    id: '5',
    role: 'user',
    content: 'Thanks',
    conversation_id: 'c1',
    created_at: '',
    context_items: null,
    metadata: null,
    input_tokens: null,
    output_tokens: null,
    seen: false,
    node_document: null,
    status: 'complete'
  }
]

const mockHeadings: HeadingItem[] = [
  {
    id: 'heading-0-heading',
    level: 1,
    text: 'Heading',
    message_id: '4',
    toc_index: 0
  }
]

const onScrollTo = vi.fn()
const onHeadingClick = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

function renderNavigator(
  messages: MessageData[] = mockMessages,
  headings: HeadingItem[] = mockHeadings
) {
  const utils = render(
    wrap(
      <ThreadNavigator
        messages={messages}
        onScrollTo={onScrollTo}
        activeIndex={0}
        headings={headings}
        onHeadingClick={onHeadingClick}
      />
    )
  )
  const dots = utils.container.querySelectorAll('nav button')
  return { utils, dots }
}

async function openCard(dots: NodeListOf<HTMLElement>, idx: number) {
  fireEvent.mouseEnter(dots[idx])
  await act(async () => {
    await new Promise((r) => setTimeout(r, 150))
  })
}

describe('ThreadNavigator', () => {
  it('renders one dot per user message when there are at least 3', () => {
    const { dots } = renderNavigator()
    expect(dots.length).toBe(3) // one dot per user message
  })

  it('does not render when there are no user messages', () => {
    const assistantOnly = mockMessages.filter((m) => m.role !== 'user')
    const { dots } = renderNavigator(assistantOnly, [])
    expect(dots.length).toBe(0)
  })

  it('shows card on hover and hides on leave', async () => {
    const { dots } = renderNavigator()
    await openCard(dots, 0)
    expect(screen.getByText('Hello')).toBeTruthy()

    fireEvent.mouseLeave(dots[0])
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500))
    })
    await waitFor(() => {
      expect(screen.queryByText('Hello')).toBeNull()
    })
  })

  it('shows preview for user messages', async () => {
    const { dots } = renderNavigator()
    await openCard(dots, 0)
    expect(screen.getByText('Hello')).toBeTruthy()
  })

  it('shows preview and chevron for assistant messages with headings', async () => {
    const { dots } = renderNavigator()
    await openCard(dots, 2) // user message idx 2 is followed by the heading'd assistant
    expect(screen.getByText('How are you?')).toBeTruthy()
    const chevron = screen.getByRole('button', { name: /expand headings/i })
    expect(chevron).toBeTruthy()
  })

  it('expands to TOC when chevron clicked', async () => {
    const { dots } = renderNavigator()
    await openCard(dots, 2)
    const chevronButton = screen.getByRole('button', {
      name: /expand headings/i
    })
    fireEvent.click(chevronButton)
    expect(screen.getByText('Heading')).toBeTruthy()
    const headingBtn = screen.getAllByText('Heading')[0].closest('button')
    fireEvent.click(headingBtn!)
    expect(onHeadingClick).toHaveBeenCalledWith(3, 0)
  })

  it('calls onScrollTo when dot clicked', async () => {
    const { dots } = renderNavigator()
    fireEvent.click(dots[2]) // 3rd user message has message index 4
    expect(onScrollTo).toHaveBeenCalledWith(4)
  })
})
