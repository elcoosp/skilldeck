import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { ToolCallCard } from '@/components/conversation/tool-call-card'

describe('ToolCallCard', () => {
  const defaultProps = {
    name: 'read_file',
    arguments: { path: '/project/src/main.rs' }
  }

  it('shows tool name in collapsed header', async () => {
    const screen = await render(<ToolCallCard {...defaultProps} />)
    const name = screen.getByText('read_file')
    await expect.element(name).toBeInTheDocument()
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

  it('shows result section when result is provided and expanded', async () => {
    const screen = await render(
      <ToolCallCard {...defaultProps} result="file contents here" />
    )
    await screen.getByText('read_file').click()
    const output = screen.getByText('Output')
    await expect.element(output).toBeInTheDocument()
    const result = screen.getByText(/file contents here/)
    await expect.element(result).toBeInTheDocument()
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
})
