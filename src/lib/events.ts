// File: src/lib/events.ts
/**
 * Typed Tauri event listeners.
 *
 * Mirrors the `#[serde(tag = "type", rename_all = "snake_case")]` enums
 * defined in `src-tauri/src/events.rs`.  The `type` discriminant is always
 * present; all other fields are optional to accommodate every variant.
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { UUID } from './types'

// ============================================================================
// Agent events  ("agent-event")
// ============================================================================

export type AgentEventType =
  | 'started'
  | 'token'
  | 'tool_call'
  | 'tool_result'
  | 'done'
  | 'error'
  | 'persisted'
  | 'tool_approval_required'  // <-- new

export interface AgentEvent {
  type: AgentEventType
  conversation_id: UUID
  delta?: string
  tool_call?: ToolCallInfo
  tool_call_id?: string
  result?: string
  input_tokens?: number
  output_tokens?: number
  message?: string
  // Fields for tool_approval_required
  tool_name?: string
  arguments?: Record<string, unknown>
}

export interface ToolCallInfo {
  id: string
  name: string
  arguments: Record<string, unknown>
}

// ============================================================================
// MCP events  ("mcp-event")
// ============================================================================

export type McpEventType =
  | 'server_connected'
  | 'server_disconnected'
  | 'tool_discovered'

export interface McpEvent {
  type: McpEventType
  name?: string
  server?: string
  tool?: McpToolInfo
}

export interface McpToolInfo {
  name: string
  description: string
}

// ============================================================================
// Workflow events  ("workflow-event")
// ============================================================================

export type WorkflowEventType =
  | 'started'
  | 'step_started'
  | 'step_completed'
  | 'completed'
  | 'failed'

export interface WorkflowEvent {
  type: WorkflowEventType
  id?: UUID
  workflow_id?: UUID
  step_id?: string
  result?: string
  message?: string
}

// ============================================================================
// Skill events  ("skill-event")
// ============================================================================

export type SkillEventType = 'updated'

export interface SkillEvent {
  type: SkillEventType
  source_label: string
  skill_name: string
}

// ============================================================================
// Listener helpers
// ============================================================================

export function onAgentEvent(
  callback: (event: AgentEvent) => void
): Promise<UnlistenFn> {
  return listen<AgentEvent>('agent-event', (e) => callback(e.payload))
}

export function onMcpEvent(
  callback: (event: McpEvent) => void
): Promise<UnlistenFn> {
  return listen<McpEvent>('mcp-event', (e) => callback(e.payload))
}

export function onWorkflowEvent(
  callback: (event: WorkflowEvent) => void
): Promise<UnlistenFn> {
  return listen<WorkflowEvent>('workflow-event', (e) => callback(e.payload))
}

export function onSkillEvent(
  callback: (event: SkillEvent) => void
): Promise<UnlistenFn> {
  return listen<SkillEvent>('skill-event', (e) => callback(e.payload))
}
