// src/__tests__/components/tool-approval-card.browser.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ToolApprovalCard } from '@/components/conversation/tool-approval-card'
import { toast } from '@/components/ui/toast'
import * as bindings from '@/lib/bindings'

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))
vi.mock('@/hooks/use-achievements', () => ({
  useAchievements: () => ({ unlock: vi.fn() })
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)

const toolCall = {
  id: 't1',
  name: 'shell',
  arguments: { cmd: 'ls' }
}

const onResolved = (): void => {}

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  vi.clearAllMocks()
})

describe('ToolApprovalCard', () => {
  it('renders the tool name and arguments', async () => {
    const screen = await render(
      <ToolApprovalCard
        toolCallId="t1"
        toolCall={toolCall}
        onResolved={onResolved}
      />,
      { wrapper }
    )
    await expect
      .element(screen.getByText('Tool approval required'))
      .toBeInTheDocument()
    await expect.element(screen.getByText('shell')).toBeInTheDocument()
    await expect.element(screen.getByText(/ls/)).toBeInTheDocument()
  })

  it('approves and resolves with parsed arguments', async () => {
    const resolveSpy = vi
      .spyOn(bindings.commands, 'resolveToolApproval')
      .mockResolvedValue({ status: 'ok', data: null })
    const resolved = vi.fn()
    const screen = await render(
      <ToolApprovalCard
        toolCallId="t1"
        toolCall={toolCall}
        onResolved={resolved}
      />,
      { wrapper }
    )
    await screen.getByRole('button', { name: /Approve/ }).click()
    await vi.waitFor(() => expect(resolved).toHaveBeenCalledOnce())
    expect(resolveSpy).toHaveBeenCalledWith('t1', true, null)
  })

  it('denies and resolves with null arguments', async () => {
    const resolveSpy = vi
      .spyOn(bindings.commands, 'resolveToolApproval')
      .mockResolvedValue({ status: 'ok', data: null })
    const resolved = vi.fn()
    const screen = await render(
      <ToolApprovalCard
        toolCallId="t1"
        toolCall={toolCall}
        onResolved={resolved}
      />,
      { wrapper }
    )
    await screen.getByRole('button', { name: /Deny/ }).click()
    await vi.waitFor(() => expect(resolved).toHaveBeenCalledOnce())
    expect(resolveSpy).toHaveBeenCalledWith('t1', false, null)
  })

  it('toasts when the resolution command fails', async () => {
    vi.spyOn(bindings.commands, 'resolveToolApproval').mockResolvedValue({
      status: 'error',
      error: 'nope'
    })
    const screen = await render(
      <ToolApprovalCard
        toolCallId="t1"
        toolCall={toolCall}
        onResolved={onResolved}
      />,
      { wrapper }
    )
    await screen.getByRole('button', { name: /Approve/ }).click()
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to resolve approval: Error: nope'
      )
    )
  })

  it('edits arguments and approves using the edited JSON', async () => {
    const resolveSpy = vi
      .spyOn(bindings.commands, 'resolveToolApproval')
      .mockResolvedValue({ status: 'ok', data: null })
    const resolved = vi.fn()
    const screen = await render(
      <ToolApprovalCard
        toolCallId="t1"
        toolCall={toolCall}
        onResolved={resolved}
      />,
      { wrapper }
    )
    await screen.getByRole('button', { name: /Edit/ }).click()
    const textarea = screen.getByRole('textbox')
    await textarea.fill('{"cmd":"ls -la"}')
    await screen.getByRole('button', { name: /Approve/ }).click()
    await vi.waitFor(() => expect(resolveSpy).toHaveBeenCalled())
    expect(resolveSpy).toHaveBeenCalledWith('t1', true, { cmd: 'ls -la' })
  })

  it('toasts invalid JSON when approving edited arguments', async () => {
    vi.spyOn(bindings.commands, 'resolveToolApproval')
    const resolved = vi.fn()
    const screen = await render(
      <ToolApprovalCard
        toolCallId="t1"
        toolCall={toolCall}
        onResolved={resolved}
      />,
      { wrapper }
    )
    await screen.getByRole('button', { name: /Edit/ }).click()
    const textarea = screen.getByRole('textbox')
    await textarea.fill('{not json}')
    await screen.getByRole('button', { name: /Approve/ }).click()
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Invalid JSON in edited arguments'
      )
    )
    expect(resolved).not.toHaveBeenCalled()
  })
})
