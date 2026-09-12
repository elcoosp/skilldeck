// src/__tests__/components/empty-state-registry.browser.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { EmptyStateRegistry } from '@/components/skills/empty-state-registry'

describe('EmptyStateRegistry', () => {
  it('renders the empty message and calls onSync', async () => {
    const onSync = vi.fn()
    const screen = await render(<EmptyStateRegistry onSync={onSync} />)
    await expect
      .element(screen.getByText('No skills in registry'))
      .toBeInTheDocument()
    screen
      .getByRole('button', { name: 'Sync now' })
      .element()
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onSync).toHaveBeenCalledTimes(1)
  })

  it('disables the sync button while syncing', async () => {
    const screen = await render(
      <EmptyStateRegistry onSync={vi.fn()} isSyncing />
    )
    await expect
      .element(screen.getByRole('button', { name: 'Sync now' }))
      .toBeDisabled()
  })
})
