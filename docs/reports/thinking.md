Let me read the codebase first.The file is truncated. Let me read the most relevant sections.Now let me also read the agent loop and the events to understand the full picture:Now I have a thorough understanding of the entire codebase. Let me also quickly check the message-input.tsx to find the existing thinking icon:Now let me check how `thinking` is currently passed to the Rust agent command:---

I now have a comprehensive view of the entire pipeline. Here is the plan:

---

## Plan: Native Ollama Thinking Integration

### Architecture overview (what the plan slots into)

```
message-input.tsx  ──(thinking: bool)──▶  commands.sendMessage
                                                │
                                    src-tauri/src/commands/messages.rs
                                                │
                                    AgentLoop::run(user_message, thinking)
                                                │
                                    CompletionRequest { thinking, … }
                                                │
                          OllamaProvider::complete()  ◀── TODAY: goes through OpenAiProvider
                                                │
                                  Tauri emits AgentEvent::Token / StreamUpdate / ThinkingUpdate
                                                │
                                    use-agent-stream.ts (processEvent)
                                                │
                                    ui-ephemeral store (streamingMessages / NEW: thinkingDocument)
                                                │
                                    message-bubble.tsx → ThinkingView + MarkdownView
```

---

### Step 1 — Rust: add `ollama-rs` and a native Ollama provider

**`src-tauri/skilldeck-core/Cargo.toml`**

```toml
[dependencies]
ollama-rs = { version = "0.3.4", features = ["stream"] }
```

**`src-tauri/skilldeck-core/src/providers/ollama_native.rs`** *(new file)*

Replace the current `OllamaProvider` (which wraps `OpenAiProvider`) with a first-class implementation using `ollama-rs`:

```rust
use ollama_rs::{
    Ollama,
    generation::{
        chat::{ChatMessage as OllamaChatMessage, request::ChatMessageRequest},
        options::GenerationOptions,
    },
};
use futures::StreamExt;

pub struct OllamaNativeProvider {
    client: Ollama,
}

impl OllamaNativeProvider {
    pub fn new(port: u16) -> Self {
        Self {
            client: Ollama::new("http://localhost".into(), port),
        }
    }
}
```

Implement `ModelProvider::complete`:

- Convert `CompletionRequest.messages` → `Vec<OllamaChatMessage>` (role mapping: `System` → user message prepended; `User` → user; `Assistant` → assistant; `Tool` → omit or fold into user).
- If `request.thinking == true`, append `.think(true)` to the `ChatMessageRequest`.
- Use `ollama.send_chat_messages_stream(req)` to get a stream.
- Map each streamed response:
  - The response from `ollama-rs` with `.think(true)` exposes `response.thinking` (Option<String>) and `response.message.content`.
  - Emit `CompletionChunk::Thinking { delta: String }` for thinking deltas (new variant, see Step 2).
  - Emit `CompletionChunk::Token { content }` for normal content.
  - Emit `CompletionChunk::Done { … }` when `response.done == true`.

**`src-tauri/skilldeck-core/src/providers/mod.rs`**

Expose `OllamaNativeProvider` and keep `OllamaProvider` as a deprecated alias or remove it.

---

### Step 2 — Rust: extend `CompletionChunk` with a `Thinking` variant

**`src-tauri/skilldeck-core/src/traits/model_provider.rs`**

```rust
pub enum CompletionChunk {
    Token { content: String },
    Thinking { delta: String },   // ← NEW
    ToolCall { tool_call: ToolCall },
    Done { input_tokens: u32, output_tokens: u32, cache_read_tokens: u32, cache_write_tokens: u32 },
}
```

All existing providers (OpenAI, Claude) never emit `Thinking`, so no changes needed there — the agent loop's `process_stream` will simply never hit that arm for them.

---

### Step 3 — Rust: thread `Thinking` chunks through the agent loop

**`src-tauri/skilldeck-core/src/agent/loop.rs`**

In `process_stream`, add a new arm:

```rust
CompletionChunk::Thinking { delta } => {
    send_event!(self, AgentLoopEvent::ThinkingToken { delta });
}
```

Add the `ThinkingToken` variant to `AgentLoopEvent`:

```rust
pub enum AgentLoopEvent {
    Token { delta: String },
    ThinkingToken { delta: String },   // ← NEW
    // …existing variants
}
```

---

### Step 4 — Rust: add `AgentEvent::ThinkingUpdate` and emit it

**`src-tauri/skilldeck-core/src/events.rs`**

```rust
pub enum AgentEvent {
    // …existing variants
    ThinkingStreamUpdate {
        conversation_id: String,
        document: NodeDocument,   // ← same type, thinking text parsed through IncrementalStream
    },
    ThinkingDone {
        conversation_id: String,
        document: NodeDocument,   // final finalized NodeDocument for thinking
    },
}
```

**`src-tauri/src/commands/messages.rs`** (the runner that bridges `AgentLoop` → Tauri events)

Add a second `IncrementalStream` instance dedicated to the thinking channel:

```rust
let mut thinking_stream = IncrementalStream::new(pipeline.clone());

// In the loop that processes AgentLoopEvent:
AgentLoopEvent::ThinkingToken { delta } => {
    if let Some(doc) = thinking_stream.push(&delta) {
        app.emit("agent-event", AgentEvent::ThinkingStreamUpdate {
            conversation_id: conv_id.clone(),
            document: doc,
        })?;
    }
}

// On Done or Cancelled:
let final_thinking_doc = thinking_stream.finalize();
app.emit("agent-event", AgentEvent::ThinkingDone {
    conversation_id: conv_id.clone(),
    document: final_thinking_doc,
})?;
```

The key insight: **thinking content is just markdown text, so it goes through the exact same `IncrementalStream` / `MarkdownPipeline` as the main content** — producing a `NodeDocument` with `stable_nodes` + `draft_nodes`. No new parsing code needed.

---

### Step 5 — TypeScript: extend event types and the ephemeral store

**`src/lib/events.ts`**

```ts
export type AgentEventType =
  | 'started' | 'token' | 'tool_call' | 'tool_result'
  | 'done' | 'error' | 'persisted' | 'tool_approval_required'
  | 'stream_update'
  | 'thinking_stream_update'   // ← NEW
  | 'thinking_done'            // ← NEW

export interface AgentEvent {
  // …existing fields
  thinking_document?: NodeDocument   // ← NEW (present on thinking_stream_update and thinking_done)
}
```

**`src/store/ui-ephemeral.ts`**

```ts
interface UIState {
  // …existing
  thinkingDocuments: Record<string, NodeDocument | null>
  setThinkingDocument: (conversationId: string, doc: NodeDocument | null) => void
}
```

---

### Step 6 — TypeScript: handle new events in `use-agent-stream.ts`

In `processEvent`:

```ts
case 'thinking_stream_update': {
  const doc: NodeDocument = (event as any).thinking_document
  if (!doc) break
  // Same stabilization pattern as stream_update — preserve stable_nodes reference
  setThinkingDocument(conversationId, stabilizedDoc)
  break
}

case 'thinking_done': {
  const doc: NodeDocument = (event as any).thinking_document
  if (!doc) break
  setThinkingDocument(conversationId, doc)
  break
}

case 'started':
  // …existing
  setThinkingDocument(conversationId, null)   // ← reset on new turn
  break

case 'persisted':
  // …existing — thinking doc is already stored on the finalized message server-side
  // Optionally clear from ephemeral store here
  break
```

---

### Step 7 — Frontend: `ThinkingView` component

**`src/components/conversation/thinking-view.tsx`** *(new file)*

```tsx
import { useState } from 'react'
import { BrainCircuit, ChevronDown, ChevronRight } from 'lucide-react'
import { MarkdownView } from '@/components/markdown-view'
import type { NodeDocument } from '@/lib/bindings'
import { cn } from '@/lib/utils'

interface ThinkingViewProps {
  document: NodeDocument | null
  messageId: string
  conversationId: string | null
  isStreaming?: boolean
}

export function ThinkingView({
  document,
  messageId,
  conversationId,
  isStreaming = false,
}: ThinkingViewProps) {
  const [expanded, setExpanded] = useState(isStreaming) // auto-open while streaming

  if (!document) return null

  return (
    <div className="mb-2 rounded-md border border-border/50 bg-muted/30">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <BrainCircuit className="size-3.5 shrink-0" />
        <span className="font-medium">
          {isStreaming ? 'Thinking…' : 'Thought process'}
        </span>
        {expanded ? (
          <ChevronDown className="ml-auto size-3" />
        ) : (
          <ChevronRight className="ml-auto size-3" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-3 pb-3 pt-2">
          {/* Reuse MarkdownView but with muted prose styling.
              No artifacts, no TOC — stable/draft node split is unchanged. */}
          <MarkdownView
            document={document}
            messageId={messageId}
            conversationId={conversationId}
            isStreaming={isStreaming}
            className={cn(
              'text-muted-foreground/80',
              '[&_code]:bg-muted [&_pre]:bg-muted',
              // suppress artifact cards and heading bookmark buttons
              '[&_.artifact-card]:hidden [&_.heading-bookmark]:hidden',
            )}
          />
        </div>
      )}
    </div>
  )
}
```

**Why reuse `MarkdownView` directly:** The `NodeDocument` format is identical — same `stable_nodes`/`draft_nodes` split, same `MdNode` variants, same incremental update logic. The only differences are visual: muted colors, no artifacts rendered, no TOC, no bookmark buttons. These are controlled by the `className` overrides and the fact that `artifact_specs` in the thinking document will always be empty (the `IncrementalStream` for thinking emits `emit_artifacts = false`).

---

### Step 8 — Wire `ThinkingView` into `message-bubble.tsx`

In the assistant message rendering section of `MessageBubble`:

```tsx
// At the top of the assistant bubble content, before <MarkdownView>:
<ThinkingView
  document={isStreaming
    ? (thinkingDoc ?? null)       // live from ephemeral store during streaming
    : (message.thinking_document ?? null)  // persisted after streaming ends
  }
  messageId={message.id}
  conversationId={conversationId}
  isStreaming={isStreaming && !!thinkingDoc}
/>
<MarkdownView … />
```

The `thinkingDoc` is read from the ephemeral store in the same way `streamingMessages` is read today — directly in `MessageThread` or `MessageBubble` to avoid re-rendering the whole tree.

---

### Step 9 — Persist thinking content (optional but recommended)

**`src-tauri/skilldeck-models` / messages migration**

Add a nullable `thinking_content TEXT` column to the messages table. In the agent runner, after `AgentLoop::run` completes, store the full accumulated thinking text alongside the assistant message content. On load, `MessageData` gains an optional `thinking_document: Option<NodeDocument>` that is rendered server-side using `MarkdownPipeline::render_full`.

This step is optional for a first pass — without it, thinking is only visible during the streaming turn and disappears on reload.

---

### Summary of file changes

| File | Change |
|---|---|
| `Cargo.toml` (core) | Add `ollama-rs` dependency |
| `providers/ollama_native.rs` | New native provider using `ollama-rs` with `think(true)` |
| `providers/mod.rs` | Expose `OllamaNativeProvider`, wire it in registry setup |
| `traits/model_provider.rs` | Add `CompletionChunk::Thinking { delta }` variant |
| `agent/loop.rs` | Handle `Thinking` chunk → emit `AgentLoopEvent::ThinkingToken` |
| `events.rs` | Add `ThinkingStreamUpdate` and `ThinkingDone` `AgentEvent` variants |
| `commands/messages.rs` | Second `IncrementalStream` for thinking; emit new events |
| `src/lib/events.ts` | Add two new `AgentEventType` values + `thinking_document` field |
| `src/store/ui-ephemeral.ts` | Add `thinkingDocuments` map + setter |
| `src/hooks/use-agent-stream.ts` | Handle `thinking_stream_update` / `thinking_done` events |
| `src/components/conversation/thinking-view.tsx` | New component (collapsible, reuses `MarkdownView`) |
| `src/components/conversation/message-bubble.tsx` | Render `ThinkingView` above assistant message content |

No changes needed to `IncrementalStream`, `MarkdownPipeline`, `MarkdownView`, `NodeDocument`, or `MdNode` — the thinking pipeline reuses them entirely as-is.
