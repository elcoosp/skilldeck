/**
 * Type-safe Tauri IPC invoke wrappers.
 *
 * Every function here is a 1-to-1 mapping to a `#[tauri::command]` defined in
 * `src-tauri/src/commands/`.  Payload keys use camelCase as Tauri's JS bridge
 * serialises Rust snake_case → camelCase automatically.
 */

import { invoke } from '@tauri-apps/api/core'
import type { UUID, DateTimeString } from './types'

// ============================================================================
// Domain types — kept in sync with Rust command return types
// ============================================================================

export interface Profile {
  id: UUID
  name: string
  model_provider: string
  model_id: string
  is_default: boolean
}

export interface ConversationSummary {
  id: UUID
  title: string | null
  profile_id: UUID
  workspace_id: UUID | null
  created_at: DateTimeString
  updated_at: DateTimeString
  message_count: number
}

export interface Message {
  id: UUID
  conversation_id: UUID
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  created_at: DateTimeString
}

export interface Skill {
  name: string
  description: string
  source: string
  is_active: boolean
}
export type AddMcpServerParams = {
  name: string
  transport: 'stdio' | 'sse'
  command?: string                     // stdio only — executable, e.g. "npx"
  args?: string[]                      // stdio only — e.g. ["-y", "@mcp/server-fs"]
  url?: string                         // sse only — e.g. "http://localhost:8080/sse"
  env?: Record<string, string>         // optional env vars for the subprocess
}
export interface McpServer {
  id: UUID
  name: string
  transport: 'stdio' | 'sse'
  status: 'connected' | 'disconnected' | 'error'
  tools: McpTool[]
}

export interface McpTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface ApiKeyStatus {
  provider: string
  has_key: boolean
}

export interface Workspace {
  id: UUID
  path: string
  name: string
  project_type: string
  is_open: boolean
}

/** A single model returned by the `list_ollama_models` command. */
export interface OllamaModelInfo {
  /** The model identifier as reported by `ollama list`, e.g. `"llama3.2:latest"`. */
  id: string
  /** Human-readable display name (may equal `id` for locally-pulled models). */
  name: string
}

// ============================================================================
// Conversations
// ============================================================================

export async function createConversation(
  profileId: UUID,
  title?: string
): Promise<UUID> {
  return invoke('create_conversation', { profileId, title })
}

export async function listConversations(
  profileId?: UUID,
  limit?: number
): Promise<ConversationSummary[]> {
  return invoke('list_conversations', { profileId, limit })
}

export async function deleteConversation(id: UUID): Promise<void> {
  return invoke('delete_conversation', { id })
}

export async function renameConversation(
  id: UUID,
  title: string
): Promise<void> {
  return invoke('rename_conversation', { id, title })
}

// ============================================================================
// Messages
// ============================================================================

export async function listMessages(
  conversationId: UUID,
  branchId?: UUID
): Promise<Message[]> {
  return invoke('list_messages', { conversationId, branchId })
}

export async function sendMessage(
  conversationId: UUID,
  content: string
): Promise<void> {
  return invoke('send_message', { conversationId, content })
}

export async function resolveToolApproval(
  toolCallId: string,
  approved: boolean,
  editedInput?: Record<string, unknown>
): Promise<void> {
  return invoke('resolve_tool_approval', { toolCallId, approved, editedInput })
}

// ============================================================================
// Profiles
// ============================================================================

export async function listProfiles(): Promise<Profile[]> {
  return invoke('list_profiles')
}

export async function createProfile(
  name: string,
  modelProvider: string,
  modelId: string
): Promise<UUID> {
  return invoke('create_profile', { name, modelProvider, modelId })
}

export async function updateProfile(
  id: UUID,
  updates: {
    name?: string
    model_provider?: string
    model_id?: string
  }
): Promise<void> {
  return invoke('update_profile', { id, ...updates })
}

export async function deleteProfile(id: UUID): Promise<void> {
  return invoke('delete_profile', { id })
}

// ============================================================================
// Skills
// ============================================================================

export async function listSkills(): Promise<Skill[]> {
  return invoke('list_skills')
}

export async function toggleSkill(
  name: string,
  enabled: boolean
): Promise<void> {
  return invoke('toggle_skill', { name, enabled })
}

// ============================================================================
// MCP
// ============================================================================
export async function addMcpServer(params: AddMcpServerParams): Promise<UUID> {
  return invoke('add_mcp_server', params)
}

export async function removeMcpServer(id: UUID): Promise<void> {
  return invoke('remove_mcp_server', { id })
}
export async function listMcpServers(): Promise<McpServer[]> {
  return invoke('list_mcp_servers')
}

export async function connectMcpServer(id: UUID): Promise<void> {
  return invoke('connect_mcp_server', { id })
}

export async function disconnectMcpServer(id: UUID): Promise<void> {
  return invoke('disconnect_mcp_server', { id })
}

// ============================================================================
// Settings — API keys
// ============================================================================

export async function listApiKeys(): Promise<ApiKeyStatus[]> {
  return invoke('list_api_keys')
}

export async function setApiKey(provider: string, key: string): Promise<void> {
  return invoke('set_api_key', { provider, key })
}

export async function deleteApiKey(provider: string): Promise<void> {
  return invoke('delete_api_key', { provider })
}

export async function validateApiKey(
  provider: string,
  key: string
): Promise<boolean> {
  return invoke('validate_api_key', { provider, key })
}

// ============================================================================
// Export
// ============================================================================

export async function exportConversation(
  id: UUID,
  format: 'markdown' | 'json',
  path: string
): Promise<void> {
  return invoke('export_conversation', { id, format, path })
}

// ============================================================================
// Workspaces
// ============================================================================

export async function openWorkspace(path: string): Promise<Workspace> {
  return invoke('open_workspace', { path })
}

export async function closeWorkspace(id: UUID): Promise<void> {
  return invoke('close_workspace', { id })
}

export async function listWorkspaces(): Promise<Workspace[]> {
  return invoke('list_workspaces')
}

// ============================================================================
// Ollama
// ============================================================================

/**
 * Return the list of models currently installed in Ollama.
 *
 * Calls the `list_ollama_models` Tauri command which runs `ollama list` on the
 * Rust side.  Falls back to a minimal default list if Ollama is not running or
 * not installed, so the UI always has something to display.
 */
export async function listOllamaModels(): Promise<OllamaModelInfo[]> {
  return invoke('list_ollama_models')
}

// ============================================================================
// Profiles — extra
// ============================================================================

/**
 * Promote a profile to be the default, demoting all others.
 * The default profile is used for every new conversation.
 */
export async function setDefaultProfile(id: UUID): Promise<void> {
  return invoke('set_default_profile', { id })
}
