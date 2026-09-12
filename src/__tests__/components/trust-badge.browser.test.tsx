// src/__tests__/components/trust-badge.browser.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ScoreDots, TrustBadge } from '@/components/skills/trust-badge'
import { TooltipProvider } from '@/components/ui/tooltip'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>{children}</TooltipProvider>
)

describe('TrustBadge', () => {
  it('shows Security Risk when the security score is below 3', async () => {
    const screen = await render(
      <TrustBadge securityScore={1} qualityScore={5} />,
      { wrapper }
    )
    await expect.element(screen.getByText('Security Risk')).toBeInTheDocument()
  })

  it('shows Low Quality when security is fine but quality is below 3', async () => {
    const screen = await render(
      <TrustBadge securityScore={4} qualityScore={1} />,
      { wrapper }
    )
    await expect.element(screen.getByText('Low Quality')).toBeInTheDocument()
  })

  it('shows Verified Safe when both scores are fine', async () => {
    const screen = await render(
      <TrustBadge securityScore={5} qualityScore={4} />,
      { wrapper }
    )
    await expect.element(screen.getByText('Verified Safe')).toBeInTheDocument()
  })

  it('calls onClick when the badge button is clicked', async () => {
    const onClick = vi.fn()
    const screen = await render(
      <TrustBadge securityScore={5} qualityScore={5} onClick={onClick} />,
      { wrapper }
    )
    await screen.getByRole('button').click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('triggers onClick on Enter keydown', async () => {
    const onClick = vi.fn()
    const screen = await render(
      <TrustBadge securityScore={1} qualityScore={1} onClick={onClick} />,
      { wrapper }
    )
    const button = screen.getByRole('button')
    button
      .element()
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      )
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('ScoreDots', () => {
  it('renders a score label of max dots', async () => {
    const screen = await render(<ScoreDots score={3} />)
    await expect
      .element(screen.getByLabelText('Score 3 of 5'))
      .toBeInTheDocument()
  })

  it('supports a custom max', async () => {
    const screen = await render(<ScoreDots score={1} max={3} />)
    await expect
      .element(screen.getByLabelText('Score 1 of 3'))
      .toBeInTheDocument()
  })
})
