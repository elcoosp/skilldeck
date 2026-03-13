import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ToolCallCard } from '@/components/conversation/tool-call-card'

describe('ToolCallCard', () => {
  const defaultProps = {
    name: 'read_file',
    arguments: { path: '/project/src/main.rs' }
  }

  // ── Collapsed state ─────────────────────────────────────────────────────────

  it('shows tool name in collapsed header', () => {
    render(<ToolCallCard {...defaultProps} />)
    expect(screen.getByText('read_file')).toBeInTheDocument()
  })

  it('does not show arguments when collapsed', () => {
    render(<ToolCallCard {...defaultProps} />)
    expect(screen.queryByText('Input')).toBeNull()
  })

  it('does not apply error styling by default', () => {
    const { container } = render(<ToolCallCard {...defaultProps} />)
    expect(container.firstElementChild?.className).not.toMatch(/destructive/)
  })

  it('applies error styling when isError=true', () => {
    const { container } = render(<ToolCallCard {...defaultProps} isError />)
    expect(container.firstElementChild?.className).toMatch(/destructive/)
  })

  // ── Expand / collapse ───────────────────────────────────────────────────────

  it('expands on header click and shows arguments', () => {
    render(<ToolCallCard {...defaultProps} />)
    fireEvent.click(screen.getByText('read_file'))
    expect(screen.getByText('Input')).toBeInTheDocument()
    expect(screen.getByText(/\/project\/src\/main\.rs/)).toBeInTheDocument()
  })

  it('collapses again on second header click', () => {
    render(<ToolCallCard {...defaultProps} />)
    fireEvent.click(screen.getByText('read_file'))
    expect(screen.getByText('Input')).toBeInTheDocument()
    fireEvent.click(screen.getByText('read_file'))
    expect(screen.queryByText('Input')).toBeNull()
  })

  it('shows result section when result is provided and expanded', () => {
    render(<ToolCallCard {...defaultProps} result="file contents here" />)
    fireEvent.click(screen.getByText('read_file'))
    expect(screen.getByText('Output')).toBeInTheDocument()
    expect(screen.getByText(/file contents here/)).toBeInTheDocument()
  })

  it('does not show result section when result is undefined', () => {
    render(<ToolCallCard {...defaultProps} />)
    fireEvent.click(screen.getByText('read_file'))
    expect(screen.queryByText('Output')).toBeNull()
  })

  it('renders complex nested arguments as pretty-printed JSON', () => {
    render(
      <ToolCallCard
        name="execute"
        arguments={{ cmd: 'ls', args: ['-la', '/tmp'], env: { FOO: 'bar' } }}
      />
    )
    fireEvent.click(screen.getByText('execute'))
    expect(screen.getByText(/\"FOO\"/)).toBeInTheDocument()
  })
})
