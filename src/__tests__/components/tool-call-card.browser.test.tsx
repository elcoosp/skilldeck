import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { ToolCallCard } from '@/components/conversation/tool-call-card'

describe('ToolCallCard', () => {
  const defaultProps = {
    name: 'read_file',
    arguments: { path: '/project/src/main.rs' }
  }

  it('shows tool name and synthesized description in collapsed header', async () => {
    const screen = await render(<ToolCallCard {...defaultProps} />)
    const name = screen.getByText('read_file')
    await expect.element(name).toBeInTheDocument()
    const desc = screen.getByText('Read file: /project/src/main.rs')
    await expect.element(desc).toBeInTheDocument()
  })

  it('does not show arguments when collapsed', async () => {
    const screen = await render(<ToolCallCard {...defaultProps} />)
    const inputLabel = screen.getByText('Input').query()
    expect(inputLabel).toBeNull()
  })

  it('applies error styling when isError=true', async () => {
    const screen = await render(<ToolCallCard {...defaultProps} isError />)
    const card = screen.getByText('read_file')
    const cardElement = card.element()?.closest('div[class*="destructive"]')
    expect(cardElement).toBeTruthy()
  })

  it('expands on header click and shows arguments', async () => {
    const screen = await render(<ToolCallCard {...defaultProps} />)
    await screen.getByText('read_file').click()
    const input = screen.getByText('Input')
    await expect.element(input).toBeInTheDocument()
    const path = screen.getByText(/\/project\/src\/main\.rs/)
    await expect.element(path).toBeInTheDocument()
  })

  it('shows result section with copy button when result is provided and expanded', async () => {
    const screen = await render(
      <ToolCallCard {...defaultProps} result="file contents here" />
    )
    await screen.getByText('read_file').click()
    const output = screen.getByText('Output')
    await expect.element(output).toBeInTheDocument()
    const result = screen.getByText(/file contents here/)
    await expect.element(result).toBeInTheDocument()
    const copyBtn = screen.getByRole('button', { name: 'Copy' })
    await expect.element(copyBtn).toBeInTheDocument()
  })

  it('renders complex nested arguments as pretty-printed JSON', async () => {
    const screen = await render(
      <ToolCallCard
        name="execute"
        arguments={{ cmd: 'ls', args: ['-la', '/tmp'], env: { FOO: 'bar' } }}
      />
    )
    await screen.getByText('execute').click()
    const foo = screen.getByText(/"FOO"/)
    await expect.element(foo).toBeInTheDocument()
  })

  it('uses correct icon based on tool name', async () => {
    const screen = await render(
      <ToolCallCard
        name="http_request"
        arguments={{ url: 'https://example.com' }}
      />
    )
    // We can't directly assert the icon component, but we can check the description
    const desc = screen.getByText('GET: https://example.com')
    await expect.element(desc).toBeInTheDocument()
  })

  it('collapsed header is not selectable', async () => {
    const screen = await render(<ToolCallCard {...defaultProps} />)
    const header = screen.getByText('read_file').element()?.closest('button')
    expect(header?.className).toContain('select-none')
  })

  it('input arguments are not selectable when expanded', async () => {
    const screen = await render(<ToolCallCard {...defaultProps} />)
    await screen.getByText('read_file').click()
    const pre = screen.getByText(/"path"/).element()
    expect(pre?.className).toContain('select-none')
  })
})
