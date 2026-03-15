/**
 * Gist / workflow sharing IPC wrappers.
 *
 * Matches the `#[tauri::command]` functions in `src-tauri/src/commands/gist.rs`.
 */

import { invoke } from '@tauri-apps/api/core'

export interface GistInfo {
  id: string
  url: string
  html_url: string
  description: string
}

export interface GistFile {
  filename: string
  content: string
}

// ── GitHub token management ───────────────────────────────────────────────────

export function setGithubToken(token: string): Promise<void> {
  return invoke('set_github_token', { token })
}

export function hasGithubToken(): Promise<boolean> {
  return invoke('has_github_token')
}

// ── Skill sharing ─────────────────────────────────────────────────────────────

export function shareSkillAsGist(params: {
  skillName: string
  contentMd: string
  description: string
}): Promise<GistInfo> {
  return invoke('share_skill_as_gist', {
    skillName: params.skillName,
    contentMd: params.contentMd,
    description: params.description
  })
}

export function importSkillFromGist(gistId: string): Promise<GistFile> {
  return invoke('import_skill_from_gist', { gistId })
}

// ── Workflow sharing ──────────────────────────────────────────────────────────

export function shareWorkflowAsGist(params: {
  workflowName: string
  workflowJson: unknown
  description: string
}): Promise<GistInfo> {
  return invoke('share_workflow_as_gist', {
    workflowName: params.workflowName,
    workflowJson: params.workflowJson,
    description: params.description
  })
}

export function importWorkflowFromGist(gistId: string): Promise<unknown> {
  return invoke('import_workflow_from_gist', { gistId })
}

// ── Conversation export ───────────────────────────────────────────────────────

export interface MessageExport {
  role: string
  content: string
}

export function exportConversationAsMarkdown(params: {
  title: string
  messages: MessageExport[]
  tags?: string[]
}): Promise<string> {
  return invoke('export_conversation_as_markdown', {
    title: params.title,
    messages: params.messages,
    tags: params.tags ?? []
  })
}
