I'll continue by first reading the codebase file to understand the existing code, then provide the updated plan with thinking rendered as regular markdown document nodes.
Let me read the key files I need to understand for the thinking integration plan.
Let me search for the critical files within the codebase dump.
Now let me also check the UI ephemeral store to understand the streaming state management.
Now I have a thorough understanding of the entire codebase architecture. Let me also check the `OpenAiProvider` since `OllamaProvider` delegates to it.
Now I have a complete picture of the codebase. Let me create the updated plan.
Here is the **updated plan** for integrating Ollama's thinking capability, with thinking rendered as a **regular markdown document node** using the same rendering pipeline as all other messages.

---

# 🧠 Ollama Thinking Integration Plan — "Markdown-as-Document" Approach

## Design Philosophy

Instead of building a special animated/expandable thinking UI component, thinking content flows through the **exact same markdown rendering pipeline** as every other message:

```
Thinking text → IncrementalStream → NodeDocument → MarkdownView
```

This means thinking appears as a naturally rendered markdown section within the assistant's message — same rendering, same code blocks, same headings — just visually distinguished by a subtle label/styling and optionally collapsible. **No special component, no different rendering path.**

---

## Phase 1: Rust Backend — Core Types & Provider

### 1.1 Add thinking types to `model_provider.rs`

**File:** `src-tauri/skilldeck-core/src/traits/model_provider.rs`

| Change | Detail |
|--------|--------|
| `CompletionChunk` enum | Add variant: `Thinking { content: String }` |
| `CompletionRequest` struct | Add field: `enable_thinking: Option<bool>` |
| `ModelParams` struct | Add field: `thinking_budget: Option<u32>` |
| `ModelCapabilities` struct | Add field: `thinking: bool` |
| `TokenUsage` struct | Add field: `thinking_tokens: u32` |
| `CompletionResult` struct | Add field: `thinking_content: Option<String>` |

### 1.2 Modify `OllamaProvider` to send thinking params

**File:** `src-tauri/skilldeck-core/src/providers/ollama.rs`

- Override `complete()` instead of delegating directly to `self.inner.complete()`
- Inject `"think": true` into the OpenAI-compatible API request body
- Parse Ollama's streaming response: detect `message.thinking` chunks (arrive before `message.content` chunks)
- Map thinking chunks → `CompletionChunk::Thinking { content }`, content chunks → `CompletionChunk::Token { content }`
- On `Done`, include thinking content in the result
- Add `thinking_budget` passthrough from `ModelParams`

**Ollama API contract:**
```
Request:  { "messages": [...], "think": true }                    // or "think": "low"|"medium"|"high"
Response: { "message": { "thinking": "...", "content": "..." } }  // streaming: thinking deltas first, then content deltas
```

### 1.3 Add thinking events to core events

**File:** `src-tauri/skilldeck-core/src/events.rs`

```rust
// New AgentEvent variants:
ThinkingDelta {
    conversation_id: String,
    delta: String,           // raw thinking text delta
},
ThinkingStreamUpdate {
    conversation_id: String,
    document: NodeDocument,  // fully rendered thinking NodeDocument (via IncrementalStream)
    new_toc_items: Vec<TocItem>,
    new_artifact_specs: Vec<ArtifactSpec>,
},
ThinkingDone {
    conversation_id: String,
    thinking_content: String, // full thinking text (for persistence)
},
```

### 1.4 Mirror events in Tauri IPC layer

**File:** `src-tauri/src/events.rs`

Add the same `ThinkingDelta`, `ThinkingStreamUpdate`, `ThinkingDone` variants to the `AgentEvent` enum with `#[derive(Event)]`.

---

## Phase 2: Rust Backend — Agent Loop & Persistence

### 2.1 Agent loop thinking handling

**File:** `src-tauri/skilldeck-core/src/agent/loop.rs` (currently binary — needs source)

The agent loop is the heart. When processing `CompletionChunk`:

1. **New state**: Maintain a `thinking_buffer: String` and a `thinking_stream: Option<IncrementalStream>` alongside the existing content buffer/stream
2. **On `CompletionChunk::Thinking { content }`**:
   - Initialize `thinking_stream` on first thinking chunk
   - Push delta to `thinking_stream.push(&content)`
   - If it returns `Some(NodeDocument)`, emit `AgentEvent::ThinkingStreamUpdate`
   - Also emit `AgentEvent::ThinkingDelta` for raw text fallback
3. **On `CompletionChunk::Token { content }`** (first content token):
   - If thinking stream exists, finalize it: `thinking_stream.take().finalize()`
   - Emit final `ThinkingStreamUpdate` with finalized thinking NodeDocument
   - Emit `ThinkingDone { thinking_content }` for persistence
   - Then begin normal content processing
4. **On `CompletionChunk::Done`**:
   - Finalize both streams if needed
   - Include thinking token count in usage

### 2.2 Database schema — add thinking columns

**File:** `src-tauri/skilldeck-models/src/messages.rs`

| Change | Detail |
|--------|--------|
| `Message` struct | Add `thinking: Option<String>` — raw thinking text |
| `Message` struct | Add `thinking_node_document: Option<Json>` — pre-rendered thinking NodeDocument |
| `Message` struct | Add `thinking_tokens: Option<i32>` — token count for thinking |

**Migration file:** New migration adding:
```sql
ALTER TABLE messages ADD COLUMN thinking TEXT;
ALTER TABLE messages ADD COLUMN thinking_node_document JSON;
ALTER TABLE messages ADD COLUMN thinking_tokens INTEGER;
```

### 2.3 Persist thinking when saving messages

**File:** Agent loop message persistence (where `Persisted` event is emitted)

- After the full response completes, save `thinking_content` to the `thinking` column
- Run the thinking text through `MarkdownPipeline` to produce a final `NodeDocument`
- Save it to `thinking_node_document` column
- Save thinking token count

---

## Phase 3: Frontend — Streaming & State

### 3.1 Add thinking state to `useUIEphemeralStore`

**File:** `src/store/ui-ephemeral.ts`

```ts
// New state fields:
streamingThinkingText: Record<string, string>    // raw thinking text per conversation
streamingThinkingDocument: Record<string, NodeDocument | null>  // rendered thinking doc per conversation
isThinking: Record<string, boolean>             // whether model is currently in thinking phase

// New actions:
appendThinkingText(conversationId: string, delta: string)
setThinkingDocument(conversationId: string, doc: NodeDocument | null)
setIsThinking(conversationId: string, value: boolean)
clearThinkingState(conversationId: string)
```

### 3.2 Handle thinking events in `use-agent-stream.ts`

**File:** `src/hooks/use-agent-stream.ts`

Add cases in the `processEvent` switch:

```ts
case 'thinking_delta':
  // Buffer raw thinking text (like existing token buffering)
  pendingThinkingBuffer.current += event.delta
  scheduleThinkingFlush()
  break

case 'thinking_stream_update':
  // Deduplicate/stabilize thinking NodeDocument (same logic as stream_update)
  setThinkingDocument(conversationId, event.node_document)
  break

case 'thinking_done':
  // Final flush of thinking buffer
  flushThinkingNow()
  setIsThinking(conversationId, false)
  break
```

On `started` event: reset thinking state (`clearThinkingState`)
On `done`/`cancelled`/`error` events: clear thinking state

### 3.3 Include thinking in streaming message

**File:** `src/hooks/use-messages.ts`

In `useMessagesWithStream`, the synthetic `__streaming__` message already carries `node_document` for the content. We need to also carry thinking:

```ts
const streamBubble: MessageData = {
  ...existingFields,
  // New fields for thinking:
  thinking: streamingThinkingText || null,
  thinking_node_document: streamingThinkingDocument || null,
}
```

This means `MessageData` (from Tauri bindings) needs `thinking` and `thinking_node_document` fields added — which happens automatically when the Rust `Message` model is updated and `tauri-specta` regenerates bindings.

---

## Phase 4: Frontend — Rendering

### 4.1 Render thinking as markdown in `MessageBubble`

**File:** `src/components/conversation/message-bubble.tsx`

In the assistant rendering block (`if (isAssistant || syntheticStreaming)`):

```tsx
// BEFORE the main contentElement, render thinking if present:
const thinkingDocument = message.thinking_node_document as NodeDocument | null
const isCurrentlyThinking = isStreaming && isThinkingState

{thinkingDocument && (
  <div className="mb-2 pb-2 border-b border-border/50">
    <span className="text-xs text-muted-foreground font-medium mb-1 block">
      Thinking
    </span>
    <MarkdownView
      document={thinkingDocument}
      messageId={`${message.id}-thinking`}
      className="prose prose-sm dark:prose-invert max-w-none break-words text-muted-foreground/80"
      conversationId={activeConversationId}
      isStreaming={isCurrentlyThinking}
      scrollContainerRef={scrollContainer}
    />
  </div>
)}
{contentElement}
```

**Key points:**
- Uses the **exact same `MarkdownView` component** as regular messages
- Uses the **exact same `NodeDocument` → `MdNode` rendering pipeline**
- Only visual distinction: subtle muted styling + "Thinking" label + border separator
- During streaming, the thinking section auto-scrolls like normal content
- After thinking phase ends, the thinking section stays visible (not auto-collapsed)
- The existing collapsible behavior for assistant messages can optionally wrap the thinking section too

### 4.2 Streaming transition behavior

During streaming, the visual sequence is:

```
[Assistant avatar]
[Thinking section — streaming, auto-scrolling]     ← MarkdownView with thinking NodeDocument
[Content section — not yet started]
```

After thinking completes:

```
[Assistant avatar]
[Thinking section — finalized, complete]            ← MarkdownView with final thinking NodeDocument
[Content section — now streaming]                   ← MarkdownView with content NodeDocument
```

After full completion:

```
[Assistant avatar]
[Thinking section — persisted, complete]            ← MarkdownView with persisted thinking_node_document
[Content section — persisted, complete]             ← MarkdownView with persisted node_document
```

### 4.3 Handle persisted messages with thinking

When loading persisted messages from DB, `MessageData` now includes:
- `thinking`: raw thinking text (optional)
- `thinking_node_document`: pre-rendered NodeDocument (optional)

The `MessageBubble` reads these directly — no special loading logic needed. If `thinking_node_document` is present, render it via `MarkdownView` above the main content. If only `thinking` text exists (fallback), generate a NodeDocument client-side using the same `getTextNodeDocument()` helper already in the file.

---

## Phase 5: Settings & UX Polish

### 5.1 Add thinking display settings

**File:** `src/store/settings.ts`

```ts
// New settings:
showThinking: boolean          // default: true — master toggle
autoCollapseThinking: boolean  // default: false — whether to start thinking collapsed
thinkingModelFilter: string[]  // default: [] — empty = show for all models
```

### 5.2 Settings UI (optional, low priority)

**File:** `src/components/settings/preferences-tab.tsx`

Add a "Thinking" section with:
- Toggle: "Show model thinking" (on/off)
- Toggle: "Auto-collapse thinking sections"
- Note: "Only supported by compatible models (Qwen 3, DeepSeek R1, etc.)"

---

## File Change Summary

| # | File | Layer | Changes |
|---|------|-------|---------|
| 1 | `traits/model_provider.rs` | Rust Core | `CompletionChunk::Thinking`, `enable_thinking`, `thinking` capability, thinking token tracking |
| 2 | `providers/ollama.rs` | Rust Core | Override `complete()` to inject `"think": true`, parse thinking chunks |
| 3 | `providers/openai.rs` | Rust Core | (Optionally) support thinking passthrough for non-Ollama providers |
| 4 | `events.rs` (core) | Rust Core | `ThinkingDelta`, `ThinkingStreamUpdate`, `ThinkingDone` events |
| 5 | `events.rs` (tauri) | Rust Tauri | Mirror thinking events with `#[derive(Event)]` |
| 6 | `agent/loop.rs` | Rust Core | Handle `Thinking` chunks, maintain parallel `IncrementalStream`, emit thinking events |
| 7 | `markdown/streaming.rs` | Rust Core | (No change needed — reuse `IncrementalStream` for thinking as-is) |
| 8 | `messages.rs` (models) | Rust Models | Add `thinking`, `thinking_node_document`, `thinking_tokens` columns |
| 9 | Migration file | Rust Migration | `ALTER TABLE messages ADD COLUMN thinking ...` |
| 10 | `store/ui-ephemeral.ts` | TS Store | Add thinking streaming state + actions |
| 11 | `hooks/use-agent-stream.ts` | TS Hook | Handle thinking events in processEvent switch |
| 12 | `hooks/use-messages.ts` | TS Hook | Include thinking in synthetic streaming message |
| 13 | `message-bubble.tsx` | TS Component | Render thinking as MarkdownView above content |
| 14 | `store/settings.ts` | TS Store | Add `showThinking`, `autoCollapseThinking` settings |
| 15 | `lib/bindings.ts` | TS (auto-gen) | Auto-regenerated by `tauri-specta` after Rust changes |

---

## Implementation Order

```
Phase 1 (Backend Types)     ─── foundation, no visible changes yet
  ↓
Phase 2 (Agent Loop + DB)   ─── core logic, messages persisted with thinking
  ↓
Phase 3 (Frontend Streaming) ─── thinking appears during streaming
  ↓
Phase 4 (Frontend Rendering) ─── thinking renders as markdown in message bubble
  ↓
Phase 5 (Settings + Polish)  ─── user controls for thinking display
```

---

## Key Design Decisions

1. **Same MarkdownView component** — zero divergence in rendering logic
2. **Separate IncrementalStream for thinking** — clean separation of concerns, no interleaving issues
3. **Thinking as first-class message field** — not crammed into metadata, properly queryable/persistable
4. **Pre-rendered thinking_node_document on persistence** — avoids re-parsing on load
5. **Fallback to raw text** — if `thinking_node_document` is null but `thinking` text exists, generate a basic NodeDocument client-side
6. **No special animation for thinking** — just a subtle label and muted styling, same auto-scroll behavior as content
7. **Streaming transition is seamless** — thinking section completes, then content section begins, both using the same visual language

---

## Risk: Missing `agent/loop.rs` Source

The agent loop file was stored as binary in the dump and could not be extracted. This is the **most critical file** for Phase 2. Before implementation begins, the actual source of `src-tauri/skilldeck-core/src/agent/loop.rs` must be obtained.

---

Would you like me to proceed with implementation, starting from Phase 1?
The updated plan is complete. Here's a concise summary of the key change from the original approach:

**Before (rejected):** Special animated/expandable thinking UI component with dedicated rendering logic.

**After (this plan):** Thinking flows through the **exact same pipeline** as regular messages — `IncrementalStream` → `NodeDocument` → `MarkdownView`. The only visual distinction is a subtle "Thinking" label and muted styling. No special rendering component, no divergent code path.

The plan covers 5 phases across 15 files, touching Rust backend types, the Ollama provider, the agent loop, database persistence, frontend streaming state, and the message bubble rendering. The critical blocker is that `agent/loop.rs` was stored as binary in the dump and needs to be obtained before Phase 2 implementation.
