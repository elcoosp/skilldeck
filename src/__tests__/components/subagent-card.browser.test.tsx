// src/__tests__/components/subagent-card.browser.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SubagentCard } from '@/components/conversation/subagent-card'

describe('SubagentCard', () => {
  it('renders step name and running label', async () => {
    const screen = await render(
      <SubagentCard stepName="Code review" status="running" />
    )
    await expect.element(screen.getByText('Code review')).toBeInTheDocument()
    await expect.element(screen.getByText('Running…')).toBeInTheDocument()
  })

  it('shows tokens and quality score when provided', async () => {
    const screen = await render(
      <SubagentCard
        stepName="Code review"
        status="done"
        tokensUsed={1234}
        qualityScore={0.87}
      />
    )
    await expect.element(screen.getByText(/1.?234 tok/)).toBeInTheDocument()
    await expect.element(screen.getByText(/87%/)).toBeInTheDocument()
    await expect.element(screen.getByText('Complete')).toBeInTheDocument()
  })

  it('renders failed status label', async () => {
    const screen = await render(
      <SubagentCard stepName="Parser" status="failed" />
    )
    await expect.element(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('renders as a button and triggers onOpen when clicked', async () => {
    const onOpen = vi.fn()
    const screen = await render(
      <SubagentCard stepName="Planner" status="running" onOpen={onOpen} />
    )
    await expect.element(screen.getByText('Planner')).toBeInTheDocument()
    const btn = screen.getByText('Planner').element()?.closest('button')
    btn?.click()
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('does not render as a button when onOpen is missing', async () => {
    const screen = await render(
      <SubagentCard stepName="Planner" status="running" />
    )
    const btn = screen.getByText('Planner').element()?.closest('button')
    expect(btn).toBeNull()
  })
})
