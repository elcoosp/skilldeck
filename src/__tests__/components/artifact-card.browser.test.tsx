// src/__tests__/components/artifact-card.browser.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ArtifactCard } from '@/components/conversation/artifact-card'

describe('ArtifactCard', () => {
  it('renders the title and content', async () => {
    const screen = await render(
      <ArtifactCard
        title="Config"
        type="code"
        language="json"
        content='{"key":"val"}'
      />
    )
    await expect.element(screen.getByText('Config')).toBeInTheDocument()
    await expect.element(screen.getByText('json')).toBeInTheDocument()
    await expect.element(screen.getByText('{"key":"val"}')).toBeInTheDocument()
  })

  it('displays "text" as the label when type is text', async () => {
    const screen = await render(
      <ArtifactCard title="Readme" type="text" content="hello" />
    )
    await expect.element(screen.getByText('text')).toBeInTheDocument()
  })

  it('displays the language as the label for code type', async () => {
    const screen = await render(
      <ArtifactCard
        title="app"
        type="code"
        language="ts"
        content="const x = 1"
      />
    )
    await expect.element(screen.getByText('ts')).toBeInTheDocument()
  })

  it('copies content to clipboard after clicking the copy button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
    const screen = await render(
      <ArtifactCard title="S" type="code" language="py" content="print('hi')" />
    )
    const button = screen.getByRole('button', { name: 'Copy artifact' })
    await button.click()
    expect(writeText).toHaveBeenCalledWith("print('hi')")
  })
})
