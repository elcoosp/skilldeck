// src/__tests__/components/empty-state-local.browser.test.tsx
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { EmptyStateLocal } from '@/components/skills/empty-state-local'

describe('EmptyStateLocal', () => {
  it('renders the empty message', async () => {
    const screen = await render(<EmptyStateLocal />)
    await expect
      .element(screen.getByText('No local skills'))
      .toBeInTheDocument()
    await expect
      .element(
        screen.getByText('Skills you create or install will appear here.')
      )
      .toBeInTheDocument()
  })
})
