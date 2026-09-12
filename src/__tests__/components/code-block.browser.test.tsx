// src/__tests__/components/code-block.browser.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { CodeBlock } from '@/components/conversation/code-block'
import { toast } from '@/components/ui/toast'
import * as bindings from '@/lib/bindings'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.spyOn(bindings.commands, 'getArtifactContent').mockResolvedValue({
    status: 'ok',
    data: 'const x = 1\nconsole.log(x)'
  })
  vi.spyOn(bindings.commands, 'listArtifactVersions').mockResolvedValue({
    status: 'ok',
    data: []
  })
})

const lines = [
  '<span class="hljs-keyword">const</span> x = <span class="hljs-number">1</span>',
  '<span class="hljs-variable">console</span>.log(x)'
]

const baseProps = {
  language: 'ts',
  artifactId: 'a1',
  highlightedLines: lines,
  lineCount: 2,
  tokenCount: 3
}

describe('CodeBlock', () => {
  it('renders the language tag and highlighted lines', async () => {
    const screen = await render(<CodeBlock {...baseProps} />, { wrapper })
    await expect.element(screen.getByText('ts').first()).toBeInTheDocument()
    await expect.element(screen.getByText(/const/).first()).toBeInTheDocument()
  })

  it('copies rawCode to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
    const screen = await render(<CodeBlock {...baseProps} />, { wrapper })
    await screen.getByRole('button', { name: 'Copy code' }).first().click()
    expect(writeText).toHaveBeenCalledWith('const x = 1\nconsole.log(x)')
    expect(toast.success).toHaveBeenCalledWith('Copied')
  })

  it('falls back to the rendered lines when rawCode is empty', async () => {
    vi.spyOn(bindings.commands, 'getArtifactContent').mockResolvedValue({
      status: 'ok',
      data: null
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
    const screen = await render(<CodeBlock {...baseProps} />, { wrapper })
    await screen.getByRole('button', { name: 'Copy code' }).first().click()
    expect(writeText).toHaveBeenCalledWith(lines.join('\n'))
  })

  it('starts expanded and collapses when the toggle is clicked', async () => {
    const screen = await render(<CodeBlock {...baseProps} />, { wrapper })
    await expect.element(screen.getByText(/const/).first()).toBeInTheDocument()
    await screen.getByRole('button', { name: 'Collapse' }).first().click()
    await expect
      .element(screen.getByRole('button', { name: 'Expand' }).first())
      .toBeInTheDocument()
    await screen.getByRole('button', { name: 'Expand' }).first().click()
    await expect.element(screen.getByText(/const/).first()).toBeInTheDocument()
  })

  it('shows the loading spinner while content is loading', async () => {
    vi.spyOn(bindings.commands, 'getArtifactContent').mockReturnValue(
      new Promise(() => {}) as never
    )
    const screen = await render(<CodeBlock {...baseProps} />, { wrapper })
    const copyBtn = screen.getByRole('button', { name: 'Copy code' }).first()
    await expect.element(copyBtn).toBeDisabled()
    const spinner = screen.container.querySelector('[class*="animate-spin"]')
    expect(spinner).not.toBeNull()
  })

  it('shows the line count and token count in the header', async () => {
    const screen = await render(
      <CodeBlock {...baseProps} lineCount={42} tokenCount={128} />,
      { wrapper }
    )
    await expect
      .element(screen.getByText(/42 lines/).first())
      .toBeInTheDocument()
    await expect
      .element(screen.getByText(/128 tok/).first())
      .toBeInTheDocument()
  })
})
