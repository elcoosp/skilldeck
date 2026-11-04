// src/__tests__/components/conflict-resolver.browser.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ConflictResolver } from '@/components/skills/conflict-resolver'

const diff = `-const x = 1
+const x = 2
 console.log(x)`

describe('ConflictResolver', () => {
  it('renders the skill name and diff lines', async () => {
    const screen = await render(
      <ConflictResolver
        skillName="my-skill"
        diff={diff}
        onKeepLocal={vi.fn()}
        onOverwrite={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await expect
      .element(screen.getByText('Update Available — my-skill'))
      .toBeInTheDocument()
    await expect.element(screen.getByText('-const x = 1')).toBeInTheDocument()
    await expect.element(screen.getByText('+const x = 2')).toBeInTheDocument()
    await expect.element(screen.getByText('console.log(x)')).toBeInTheDocument()
  })

  it('calls onKeepLocal when Keep Local is clicked', async () => {
    const onKeepLocal = vi.fn()
    const screen = await render(
      <ConflictResolver
        skillName="my-skill"
        diff={diff}
        onKeepLocal={onKeepLocal}
        onOverwrite={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await screen.getByRole('button', { name: 'Keep Local' }).click()
    expect(onKeepLocal).toHaveBeenCalledTimes(1)
  })

  it('calls onOverwrite when Overwrite with Registry is clicked', async () => {
    const onOverwrite = vi.fn()
    const screen = await render(
      <ConflictResolver
        skillName="my-skill"
        diff={diff}
        onKeepLocal={vi.fn()}
        onOverwrite={onOverwrite}
        onClose={vi.fn()}
      />
    )
    await screen
      .getByRole('button', { name: 'Overwrite with Registry' })
      .click()
    expect(onOverwrite).toHaveBeenCalledTimes(1)
  })

  it('calls onClose from the Manual Merge button and on dialog close', async () => {
    const onClose = vi.fn()
    const screen = await render(
      <ConflictResolver
        skillName="my-skill"
        diff={diff}
        onKeepLocal={vi.fn()}
        onOverwrite={vi.fn()}
        onClose={onClose}
      />
    )
    await screen.getByRole('button', { name: 'Manual Merge' }).click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
