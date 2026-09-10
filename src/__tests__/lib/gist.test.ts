import { invoke } from '@tauri-apps/api/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  exportConversationAsMarkdown,
  hasGithubToken,
  importSkillFromGist,
  importWorkflowFromGist,
  setGithubToken,
  shareSkillAsGist,
  shareWorkflowAsGist
} from '@/lib/gist'

const invokeMock = vi.mocked(invoke)

beforeEach(() => {
  invokeMock.mockReset()
  invokeMock.mockResolvedValue(undefined)
})

describe('GitHub token', () => {
  it('sets the GitHub token', async () => {
    await setGithubToken('ghp_123')
    expect(invokeMock).toHaveBeenCalledWith('set_github_token', {
      token: 'ghp_123'
    })
  })

  it('checks for a GitHub token', async () => {
    invokeMock.mockResolvedValueOnce(true)
    await expect(hasGithubToken()).resolves.toBe(true)
    expect(invokeMock).toHaveBeenCalledWith('has_github_token')
  })
})

describe('skill sharing', () => {
  it('shares a skill as a gist', async () => {
    const gist = { id: 'g1', url: 'u', html_url: 'h', description: 'd' }
    invokeMock.mockResolvedValueOnce(gist)
    await expect(
      shareSkillAsGist({
        skillName: 'demo',
        contentMd: '# Demo',
        description: 'A demo skill'
      })
    ).resolves.toEqual(gist)
    expect(invokeMock).toHaveBeenCalledWith('share_skill_as_gist', {
      skillName: 'demo',
      contentMd: '# Demo',
      description: 'A demo skill'
    })
  })

  it('imports a skill from a gist', async () => {
    invokeMock.mockResolvedValueOnce({ filename: 'a.md', content: 'x' })
    await expect(importSkillFromGist('abc')).resolves.toEqual({
      filename: 'a.md',
      content: 'x'
    })
    expect(invokeMock).toHaveBeenCalledWith('import_skill_from_gist', {
      gistId: 'abc'
    })
  })
})

describe('workflow sharing', () => {
  it('shares a workflow as a gist', async () => {
    invokeMock.mockResolvedValueOnce({ id: 'g1' })
    await expect(
      shareWorkflowAsGist({
        workflowName: 'wf',
        workflowJson: { steps: [] },
        description: 'A workflow'
      })
    ).resolves.toEqual({ id: 'g1' })
    expect(invokeMock).toHaveBeenCalledWith('share_workflow_as_gist', {
      workflowName: 'wf',
      workflowJson: { steps: [] },
      description: 'A workflow'
    })
  })

  it('imports a workflow from a gist', async () => {
    invokeMock.mockResolvedValueOnce({ steps: [] })
    await expect(importWorkflowFromGist('xyz')).resolves.toEqual({ steps: [] })
    expect(invokeMock).toHaveBeenCalledWith('import_workflow_from_gist', {
      gistId: 'xyz'
    })
  })
})

describe('conversation export', () => {
  it('exports a conversation as markdown', async () => {
    invokeMock.mockResolvedValueOnce('# Chat')
    await expect(
      exportConversationAsMarkdown({
        title: 'Chat',
        messages: [{ role: 'user', content: 'hi' }]
      })
    ).resolves.toBe('# Chat')
    expect(invokeMock).toHaveBeenCalledWith('export_conversation_as_markdown', {
      title: 'Chat',
      messages: [{ role: 'user', content: 'hi' }],
      tags: []
    })
  })

  it('defaults tags to an empty array', async () => {
    await exportConversationAsMarkdown({
      title: 'Chat',
      messages: [],
      tags: ['work']
    })
    expect(invokeMock).toHaveBeenCalledWith('export_conversation_as_markdown', {
      title: 'Chat',
      messages: [],
      tags: ['work']
    })
  })
})
