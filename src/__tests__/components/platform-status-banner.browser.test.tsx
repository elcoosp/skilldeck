// src/__tests__/components/platform-status-banner.browser.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { PlatformStatusBanner } from '@/components/skills/platform-status-banner'

describe('PlatformStatusBanner', () => {
  it('renders nothing when variant is null', async () => {
    const screen = await render(
      <PlatformStatusBanner variant={null} onEnable={vi.fn()} />
    )
    await expect
      .element(screen.getByText('Platform features are disabled.'))
      .not.toBeInTheDocument()
  })

  it('renders the disabled state with an Enable action', async () => {
    const onEnable = vi.fn()
    const screen = await render(
      <PlatformStatusBanner variant="disabled" onEnable={onEnable} />
    )
    await expect
      .element(
        screen.getByText(
          'Platform features are disabled. Connect to browse community skills.'
        )
      )
      .toBeInTheDocument()
    await screen.getByRole('button', { name: 'Enable' }).click()
    expect(onEnable).toHaveBeenCalledTimes(1)
  })

  it('renders the not-configured state with a Register action', async () => {
    const onRegister = vi.fn()
    const screen = await render(
      <PlatformStatusBanner
        variant="error"
        errorMessage="Platform Not configured"
        onRegister={onRegister}
      />
    )
    await expect
      .element(screen.getByText('Platform not registered.'))
      .toBeInTheDocument()
    await screen.getByRole('button', { name: 'Register' }).click()
    expect(onRegister).toHaveBeenCalledTimes(1)
  })

  it('renders the generic error state with a Retry action', async () => {
    const onRetry = vi.fn()
    const screen = await render(
      <PlatformStatusBanner
        variant="error"
        errorMessage="Network down"
        onRetry={onRetry}
      />
    )
    await expect
      .element(screen.getByText('Cannot connect to skill registry.'))
      .toBeInTheDocument()
    await screen.getByRole('button', { name: 'Retry' }).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
