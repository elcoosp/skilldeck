// src/__tests__/components/tool-result-bubble.browser.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ToolResultBubble } from '@/components/conversation/tool-result-bubble'
import { toast } from '@/components/ui/toast'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

const plainText = `line one\nline two\nline three`

const fileTree = `[FILE] src/index.ts\n[DIR] src/components\n[FILE] src/components/app.tsx\n[FILE] src/components/app.tsx\n[FILE] src/components/app.tsx`

describe('ToolResultBubble', () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear()
  })

  it('renders the tool name in the header and starts collapsed', async () => {
    const screen = await render(
      <ToolResultBubble content={plainText} toolName="shell_exec" />
    )
    await expect.element(screen.getByText('Shell exec')).toBeInTheDocument()
    await expect.element(screen.getByText('Result')).toBeInTheDocument()
    await expect.element(screen.getByText('line one')).not.toBeInTheDocument()
  })

  it('expands content when the expand button is clicked', async () => {
    const screen = await render(
      <ToolResultBubble content={plainText} toolName="shell_exec" />
    )
    const expandBtn = screen.getByRole('button', { name: 'Expand' })
    await expandBtn.click()
    await expect.element(screen.getByText('line one')).toBeInTheDocument()
    await expect.element(screen.getByText('line two')).toBeInTheDocument()
  })

  it('collapses when the collapse button is clicked', async () => {
    const screen = await render(
      <ToolResultBubble content={plainText} toolName="test" />
    )
    await screen.getByRole('button', { name: 'Expand' }).click()
    await expect.element(screen.getByText('line one')).toBeInTheDocument()
    await screen.getByRole('button', { name: 'Collapse' }).click()
    await expect.element(screen.getByText('line one')).not.toBeInTheDocument()
  })

  it('displays error badge when isError is true', async () => {
    const screen = await render(<ToolResultBubble content="err" isError />)
    await expect.element(screen.getByText('Error')).toBeInTheDocument()
  })

  it('shows wrench icon label when no toolName is provided', async () => {
    const screen = await render(<ToolResultBubble content={plainText} />)
    await expect.element(screen.getByText('Tool Result')).toBeInTheDocument()
  })

  it('renders a file tree when the content has [FILE]/[DIR] lines', async () => {
    const screen = await render(
      <ToolResultBubble content={fileTree} toolName="dir_list" />
    )
    await screen.getByRole('button', { name: 'Expand' }).click()
    await expect.element(screen.getByText('index.ts')).toBeInTheDocument()
    await expect.element(screen.getByText('components')).toBeInTheDocument()
  })

  it('renders JSON with a show more button when there are many lines', async () => {
    const bigJson = JSON.stringify(
      Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i])),
      null,
      2
    )
    const screen = await render(
      <ToolResultBubble content={bigJson} toolName="api_call" />
    )
    await screen.getByRole('button', { name: 'Expand' }).click()
    await expect
      .element(screen.getByText(/Show .* more lines/))
      .toBeInTheDocument()
  })

  it('copies content to the clipboard and shows a toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
    const screen = await render(
      <ToolResultBubble content="copy me" toolName="test" />
    )
    await screen.getByRole('button', { name: 'Copy result' }).click()
    expect(writeText).toHaveBeenCalledWith('copy me')
    expect(toast.success).toHaveBeenCalledWith('Result copied to clipboard')
  })
})
