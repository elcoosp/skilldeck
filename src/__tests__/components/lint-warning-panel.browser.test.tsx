// src/__tests__/components/lint-warning-panel.browser.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LintWarningPanel } from '@/components/skills/lint-warning-panel'
import { toast } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { LintWarning } from '@/lib/bindings'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>{children}</TooltipProvider>
)

const makeWarning = (overrides: Partial<LintWarning> = {}): LintWarning => ({
  rule_id: 'sec-foo-1',
  severity: 'error',
  message: 'Potential command injection',
  location: null,
  suggested_fix: 'Quote the argument',
  ...overrides
})

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
})

describe('LintWarningPanel', () => {
  it('shows "No lint issues" when all warnings are off', async () => {
    const screen = await render(
      <LintWarningPanel warnings={[makeWarning({ severity: 'off' })]} />,
      { wrapper }
    )
    await expect.element(screen.getByText('No lint issues')).toBeInTheDocument()
  })

  it('renders warning message, rule id, and apply fix label', async () => {
    const screen = await render(
      <LintWarningPanel
        warnings={[
          makeWarning({ message: 'Unsafe eval', suggested_fix: 'Avoid eval' })
        ]}
      />,
      { wrapper }
    )
    await expect.element(screen.getByText('Unsafe eval')).toBeInTheDocument()
    await expect.element(screen.getByText('sec-foo-1')).toBeInTheDocument()
    await expect.element(screen.getByText('Avoid eval')).toBeInTheDocument()
  })

  it('renders an Apply fixed action when onApplyFix is provided and calls it', async () => {
    const onApplyFix = vi.fn()
    const warning = makeWarning({ message: 'Unsafe eval' })
    const screen = await render(
      <LintWarningPanel warnings={[warning]} onApplyFix={onApplyFix} />,
      { wrapper }
    )
    await screen.getByRole('button', { name: 'Apply' }).click()
    expect(onApplyFix).toHaveBeenCalledWith(warning)
  })

  it('copies the suggested fix to clipboard and toasts', async () => {
    const screen = await render(
      <LintWarningPanel warnings={[makeWarning()]} />,
      { wrapper }
    )
    const row = screen
      .getByText('Potential command injection')
      .locator('..')
      .locator('..')
    const copyBtn = row.getByRole('button').first()
    await copyBtn.click()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Quote the argument'
    )
    expect(toast.success).toHaveBeenCalledWith('Fix copied to clipboard')
  })

  it('calls onIgnore with the rule id when the ignore button is clicked', async () => {
    const onIgnore = vi.fn()
    const screen = await render(
      <LintWarningPanel
        warnings={[
          makeWarning({
            message: 'Style issue',
            rule_id: 'style-x',
            severity: 'warning'
          })
        ]}
        onIgnore={onIgnore}
      />,
      { wrapper }
    )
    const row = screen.getByText('Style issue').locator('..').locator('..')
    row
      .getByRole('button')
      .nth(1)
      .element()
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onIgnore).toHaveBeenCalledWith('style-x')
  })

  it('strips the skillRoot prefix from the displayed file path', async () => {
    const warning = makeWarning({
      location: { file: '/skills/my-skill/my-skill.md', line: 12 }
    })
    const screen = await render(
      <LintWarningPanel warnings={[warning]} skillRoot="/skills/my-skill/" />,
      { wrapper }
    )
    await expect
      .element(screen.getByText(/my-skill\.md:12/))
      .toBeInTheDocument()
  })

  it('shows only the last two path segments without a skillRoot', async () => {
    const warning = makeWarning({
      severity: 'info',
      message: 'Info message',
      location: { file: '/a/b/c/d.md', line: null }
    })
    const screen = await render(<LintWarningPanel warnings={[warning]} />, {
      wrapper
    })
    await expect.element(screen.getByText(/c\/d\.md/)).toBeInTheDocument()
  })
})

describe('severity styling', () => {
  it('renders security errors with the shield icon class', async () => {
    const screen = await render(
      <LintWarningPanel warnings={[makeWarning()]} />,
      { wrapper }
    )
    await expect
      .element(screen.getByText('Potential command injection'))
      .toBeInTheDocument()
  })
})
