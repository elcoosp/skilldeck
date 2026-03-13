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

export interface AgentEvent {
  type: AgentEventType
  conversation_id: UUID
  /** `token` variant */
  delta?: string
  /** `tool_call` variant */
  tool_call?: ToolCallInfo
  /** `tool_result` variant */
  tool_call_id?: string
  result?: string
  /** `done` variant */
  input_tokens?: number
  output_tokens?: number
  /** `error` variant */
  message?: string
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
// Listener helpers
// ============================================================================

/**
 * Subscribe to agent events.
 * Returns an unlisten function — call it in `useEffect` cleanup.
 */
export function onAgentEvent(
  callback: (event: AgentEvent) => void
): Promise<UnlistenFn> {
  return listen<AgentEvent>('agent-event', (e) => callback(e.payload))
}

/**
 * Subscribe to MCP server / tool lifecycle events.
 */
export function onMcpEvent(
  callback: (event: McpEvent) => void
): Promise<UnlistenFn> {
  return listen<McpEvent>('mcp-event', (e) => callback(e.payload))
}

/**
 * Subscribe to workflow execution progress events.
 */
export function onWorkflowEvent(
  callback: (event: WorkflowEvent) => void
): Promise<UnlistenFn> {
  return listen<WorkflowEvent>('workflow-event', (e) => callback(e.payload))
}
