// src/__tests__/components/share-skill-modal.browser.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ShareSkillModal } from '@/components/skills/share-skill-modal'
import { toast } from '@/components/ui/toast'
import { hasGithubToken, setGithubToken, shareSkillAsGist } from '@/lib/gist'

vi.mock('@/lib/gist', () => ({
  hasGithubToken: vi.fn(),
  setGithubToken: vi.fn(),
  shareSkillAsGist: vi.fn(),
  importSkillFromGist: vi.fn(),
  shareWorkflowAsGist: vi.fn(),
  importWorkflowFromGist: vi.fn()
}))

vi.mock('@/lib/platform', () => ({
  sendActivityEvent: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/components/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

const gist = {
  id: 'g1',
  url: 'https://gist.github.com/g1',
  html_url: 'https://gist.github.com/g1',
  description: 'SkillDeck skill: my-skill'
}

beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  vi.mocked(hasGithubToken).mockReset()
  vi.mocked(setGithubToken).mockReset()
  vi.mocked(shareSkillAsGist).mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) }
  })
})

describe('ShareSkillModal', () => {
  it('goes to the github-auth step when no token is connected', async () => {
    vi.mocked(hasGithubToken).mockResolvedValue(false)
    const screen = await render(
      <ShareSkillModal skillName="my-skill" contentMd="# x" onClose={vi.fn()} />
    )
    await screen.getByRole('button', { name: 'Share as GitHub Gist' }).click()
    await expect.element(screen.getByText('GitHub Token')).toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: 'Connect & share' }))
      .toBeInTheDocument()
  })

  it('shares the gist immediately when a token is connected', async () => {
    vi.mocked(hasGithubToken).mockResolvedValue(true)
    vi.mocked(shareSkillAsGist).mockResolvedValue(gist)
    const screen = await render(
      <ShareSkillModal skillName="my-skill" contentMd="# x" onClose={vi.fn()} />
    )
    await screen.getByRole('button', { name: 'Share as GitHub Gist' }).click()
    await expect
      .element(screen.getByText('Skill shared! 🎉'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('https://gist.github.com/g1'))
      .toBeInTheDocument()
    expect(shareSkillAsGist).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: 'my-skill',
        description: 'SkillDeck skill: my-skill'
      })
    )
  })

  it('keeps the Connect & share button disabled until a token is typed', async () => {
    vi.mocked(hasGithubToken).mockResolvedValue(false)
    const screen = await render(
      <ShareSkillModal skillName="my-skill" contentMd="# x" onClose={vi.fn()} />
    )
    await screen.getByRole('button', { name: 'Share as GitHub Gist' }).click()
    const connect = screen.getByRole('button', { name: 'Connect & share' })
    await expect.element(connect).toBeDisabled()
    await screen.getByLabelText('GitHub Token').fill('ghp_abc')
    await connect.click()
    expect(setGithubToken).toHaveBeenCalledWith('ghp_abc')
    expect(shareSkillAsGist).toHaveBeenCalled()
  })

  it('copies the gist URL via the Copy button', async () => {
    vi.mocked(hasGithubToken).mockResolvedValue(true)
    vi.mocked(shareSkillAsGist).mockResolvedValue(gist)
    const screen = await render(
      <ShareSkillModal skillName="my-skill" contentMd="# x" onClose={vi.fn()} />
    )
    await screen.getByRole('button', { name: 'Share as GitHub Gist' }).click()
    await screen.getByRole('button', { name: 'Copy' }).click()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(gist.html_url)
    expect(toast.success).toHaveBeenCalledWith('Copied!')
  })

  it('fires toast.error when the token check fails', async () => {
    vi.mocked(hasGithubToken).mockRejectedValue(new Error('boom'))
    const screen = await render(
      <ShareSkillModal skillName="my-skill" contentMd="# x" onClose={vi.fn()} />
    )
    await screen.getByRole('button', { name: 'Share as GitHub Gist' }).click()
    await expect.element(screen.getByText('boom')).not.toBeInTheDocument()
    expect(toast.error).toHaveBeenCalled()
  })
})
