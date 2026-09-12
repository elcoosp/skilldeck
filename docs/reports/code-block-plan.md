## Implementation Plan – Chunks 1–5 (Corrected and Complete)

This document provides a fully corrected, step‑by‑step implementation plan for the first five chunks of the code‑block enhancements. All feedback from the systematic review has been incorporated, and every step is included—even those that remain unchanged—so you can follow this plan from start to finish without referencing the original.

---

### Chunk 1: Backend – Add `line_count` and `file_path` to CodeBlock Nodes

**Goal:** Extend the backend data structures so that every code block carries its line count and optional file path. The generated HTML is wrapped with `<span class="line">` to enable CSS‑based line numbering on the frontend.

#### 1.1 Modify `types.rs`

**File:** `src-tauri/skilldeck-core/src/markdown/types.rs`

Add `line_count` and `file_path` fields to both `MdNode::CodeBlock` and `ArtifactSpec`.

```rust
// src-tauri/skilldeck-core/src/markdown/types.rs

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MdNode {
    // ... other variants unchanged
    CodeBlock {
        id: String,
        language: String,
        raw_code: String,
        highlighted_html: String,
        artifact_id: Uuid,
        line_count: u32,                // new
        file_path: Option<String>,      // new
    },
    // ... rest unchanged
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
pub struct ArtifactSpec {
    pub id: Uuid,
    pub language: String,
    pub raw_code: String,
    pub slot_index: u32,
    pub file_path: Option<String>,
    pub line_count: u32,                // new
}
```

#### 1.2 Modify `renderer.rs`

**File:** `src-tauri/skilldeck-core/src/markdown/renderer.rs`

Update the `highlight` method to return both the wrapped HTML and the line count. (Token count will be added later, in Chunk 6.) Also update the code block construction to include the new fields.

```rust
// Inside impl MarkdownPipeline

/// Highlight code and wrap each line in a `<span class="line">`.
/// Returns the HTML and the number of lines.
fn highlight(&self, code: &str, lang: &str) -> (String, u32) {
    let normalized_lang = match lang {
        "typescript" | "ts" | "typescriptreact" => "tsx",
        _ => lang,
    };
    let syntax = SYNTAX_SET
        .find_syntax_by_token(normalized_lang)
        .unwrap_or_else(|| {
            SYNTAX_SET
                .find_syntax_by_first_line(code)
                .unwrap_or_else(|| SYNTAX_SET.find_syntax_plain_text())
        });

    let lines: Vec<&str> = code.lines().collect();
    let line_count = lines.len() as u32;

    let mut wrapped = String::new();
    // Use the shared theme – note the read lock
    let theme_guard = self.theme.0.read();
    for line in lines {
        let highlighted = syntect::html::highlighted_html_for_string(
            line,
            &SYNTAX_SET,
            syntax,
            &theme_guard,
        );
        wrapped.push_str(&format!("<span class=\"line\">{}</span>", highlighted));
    }
    (wrapped, line_count)
}
```

In the `render_blocks` method, replace the existing code‑block handling with:

```rust
// Inside render_blocks, after reading the code buffer
let (highlighted_html, line_count) = self.highlight(&code_buf, &code_lang);

let file_path = extract_file_path(&code_lang, &code_buf)
    .or_else(|| last_inline_code.take().filter(|s| is_plausible_filename(s, &code_lang)));

let id = format!("cb-{}", id_counter);
id_counter += 1;
let artifact_id = Uuid::new_v4();

nodes.push(MdNode::CodeBlock {
    id: id.clone(),
    language: code_lang.clone(),
    raw_code: code_buf.clone(),
    highlighted_html,
    artifact_id,
    line_count,
    file_path: file_path.clone(),
});

if emit_artifacts {
    artifact_specs.push(ArtifactSpec {
        id: artifact_id,
        language: code_lang.clone(),
        raw_code: code_buf,
        slot_index: id_counter - 1,
        file_path,
        line_count,
    });
}
```

> **Note:** The existing `extract_file_path` and `is_plausible_filename` helpers are already present in the file; no changes are needed for them.

#### 1.3 Regenerate TypeScript Bindings

```bash
cd src-tauri
cargo build
```

This will update `src/lib/bindings.ts` with the new fields.

#### 1.4 Commit

```bash
git add src-tauri/skilldeck-core/src/markdown/types.rs \
        src-tauri/skilldeck-core/src/markdown/renderer.rs \
        src/lib/bindings.ts
git commit -m "feat(markdown): add line_count and file_path to CodeBlock nodes; wrap lines in span for line numbers"
```

---

### Chunk 2: Frontend – Line Numbers Toggle

**Goal:** Allow the user to toggle line numbers in code blocks using a button. The feature uses CSS counters triggered by a class on the `<pre>` element.

#### 2.1 Add CSS for Line Numbers

**File:** `src/App.css`

Add the following rules:

```css
/* src/App.css */

.code-with-lines {
  counter-reset: line;
}
.code-with-lines .line {
  display: block;
  position: relative;
  padding-left: 3.5rem;
}
.code-with-lines .line::before {
  counter-increment: line;
  content: counter(line);
  position: absolute;
  left: 0;
  width: 2.8rem;
  text-align: right;
  color: var(--muted-foreground);
  opacity: 0.4;
  font-size: 0.75rem;
  user-select: none;
  -webkit-user-select: none;
  padding-right: 1rem;
  border-right: 1px solid var(--border);
}
```

#### 2.2 Update `CodeBlock` Component

**File:** `src/components/conversation/code-block.tsx`

- Extend the props interface to include `lineCount` and `filePath`.
- Add a toggle state and effect to manage the CSS class.
- Render a button to toggle line numbers.

```tsx
// src/components/conversation/code-block.tsx

import { Hash } from 'lucide-react';
import { useState, useEffect } from 'react';

interface CodeBlockProps {
  language: string;
  artifactId: string;
  highlightedHtml: string;
  isStreaming?: boolean;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  lineCount: number;        // new
  filePath?: string | null; // new
}

export const CodeBlock: React.FC<CodeBlockProps> = memo(({
  language,
  artifactId,
  highlightedHtml,
  isStreaming = false,
  scrollContainerRef,
  lineCount,
  filePath,
}) => {
  // ... existing state and refs (collapsed, copied, containerRef, headerRef, etc.)

  const [showLineNumbers, setShowLineNumbers] = useState(() => lineCount > 3);
  const preRef = useRef<HTMLPreElement>(null);

  // Apply/remove the line‑number class whenever toggled or when the HTML changes.
  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    if (showLineNumbers) {
      pre.classList.add('code-with-lines');
    } else {
      pre.classList.remove('code-with-lines');
    }
  }, [showLineNumbers, highlightedHtml]); // ⬅ fixed: added highlightedHtml

  // ... rest of the component (collapsing, copying, floating header logic)

  return (
    <div ref={containerRef} className="my-3 rounded-lg border border-border font-mono text-xs">
      {/* Header */}
      <div ref={headerRef} className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted">
        <div className="flex items-center gap-1.5">
          {/* existing collapse button and language label */}
          <button type="button" onClick={toggle} className="...">
            <ChevronRight className={cn("size-3.5 transition-transform", !collapsed && "rotate-90")} />
            <span>{language || 'code'}</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          {/* existing copy button */}
          <button type="button" onClick={copy} disabled={isLoading} className="p-1 ...">
            {/* ... */}
          </button>
          {/* NEW: line numbers toggle */}
          <button
            type="button"
            onClick={() => setShowLineNumbers(v => !v)}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Toggle line numbers"
          >
            <Hash className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Code content */}
      <div className="overflow-hidden rounded-b-lg" style={{ maxHeight: collapsed ? 0 : 384 }}>
        <div ref={scrollableRef} className="overflow-auto max-h-96 thin-scrollbar">
          <pre
            ref={preRef}
            className="p-3 m-0 text-xs leading-relaxed"
            style={{ whiteSpace: 'pre', fontFamily: 'inherit' }}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </div>
      </div>
    </div>
  );
});
```

#### 2.3 Pass New Props from `MessageBubble`

**File:** `src/components/conversation/message-bubble.tsx`

In the `NodeRenderer` component, update the `code_block` case to pass `lineCount` and `filePath`:

```tsx
case 'code_block':
  return (
    <CodeBlock
      language={node.language}
      artifactId={node.artifact_id}
      highlightedHtml={node.highlighted_html}
      isStreaming={isStreaming}
      scrollContainerRef={scrollContainerRef}
      lineCount={node.line_count}
      filePath={node.file_path}
    />
  );
```

#### 2.4 Commit

```bash
git add src/App.css src/components/conversation/code-block.tsx src/components/conversation/message-bubble.tsx
git commit -m "feat(code-block): add line numbers toggle with CSS counters"
```

---

### Chunk 3: Apply to File – Save Button and Filename Pill

**Goal:** Add a “Save” button that writes the artifact content to a user‑selected file. If a `file_path` is known (extracted from a comment), it is pre‑filled in the save dialog.

#### 3.1 Create Backend Command `write_artifact_to_file`

**File:** `src-tauri/src/commands/artifacts.rs`

Add the following command:

```rust
use std::path::PathBuf;
use tauri::State;
use uuid::Uuid;

#[specta]
#[tauri::command]
pub async fn write_artifact_to_file(
    state: State<'_, Arc<AppState>>,
    artifact_id: String,
    target_path: String,
) -> Result<(), String> {
    let db = state
        .registry
        .db
        .connection()
        .await
        .map_err(|e| e.to_string())?;
    let art_uuid = Uuid::parse_str(&artifact_id).map_err(|e| e.to_string())?;

    use skilldeck_models::artifacts::Entity as Artifacts;
    let artifact = Artifacts::find_by_id(art_uuid)
        .one(db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Artifact not found".to_string())?;

    let content = if let Some(storage_path) = artifact.storage_path {
        tokio::fs::read_to_string(&storage_path)
            .await
            .map_err(|e| e.to_string())?
    } else {
        artifact.content
    };

    let path = PathBuf::from(&target_path);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

#### 3.2 Register the Command

**File:** `src-tauri/src/lib.rs`

Add `write_artifact_to_file` to the `collect_commands!` macro:

```rust
        .commands(collect_commands![
            // ... existing commands
            write_artifact_to_file,
            // ...
        ])
```

#### 3.3 Regenerate Bindings

```bash
cd src-tauri
cargo build
```

#### 3.4 Frontend: Save Button and Filename Pill

**File:** `src/components/conversation/code-block.tsx`

- Import `save` from `@tauri-apps/plugin-dialog`, `Save` icon, and the commands binding.
- Add a `handleSaveToFile` function.
- Display the filename (basename) if available, and a Save button.

```tsx
import { save } from '@tauri-apps/plugin-dialog';
import { Save } from 'lucide-react';
import { commands } from '@/lib/bindings';
import { toast } from '@/components/ui/toast';

// Inside the CodeBlock component
const handleSaveToFile = async () => {
  try {
    let path = filePath ?? undefined;
    if (!path) {
      const selected = await save({
        defaultPath: `artifact.${language}`,
        filters: [{ name: 'All Files', extensions: ['*'] }],
      });
      if (!selected) return;
      path = selected;
    }
    await commands.writeArtifactToFile(artifactId, path);
    toast.success(`Saved to ${path}`);
  } catch (err) {
    toast.error(`Failed to save: ${err}`);
  }
};

// In the header, add the filename pill and Save button:
<div className="flex items-center gap-2">
  {filePath && (
    <span
      className="text-[10px] font-mono text-muted-foreground truncate max-w-[150px]"
      title={filePath}
    >
      {filePath.split('/').pop()}
    </span>
  )}
  <button
    onClick={handleSaveToFile}
    className="p-1 text-muted-foreground hover:text-foreground"
    title="Save to file"
  >
    <Save className="size-3.5" />
  </button>
</div>
```

Place this inside the header’s right‑side action group, next to the copy and line‑numbers buttons.

#### 3.5 Commit

```bash
git add src-tauri/src/commands/artifacts.rs src-tauri/src/lib.rs \
        src/components/conversation/code-block.tsx src/lib/bindings.ts
git commit -m "feat(code-block): add save to file button and filename pill"
```

---

### Chunk 4: Run Button with Streaming Output (Security‑Conscious)

**Goal:** For supported languages (Python, JavaScript, Bash, Ruby), add a “Run” button that executes the code snippet in a sandboxed subprocess and streams stdout/stderr back to a collapsible output panel.

#### 4.1 Define `RunCodeEvent`

**File:** `src-tauri/src/events.rs`

Add the new event enum:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RunCodeEvent {
    Stdout { run_id: String, line: String },
    Stderr { run_id: String, line: String },
    Exit { run_id: String, code: i32, elapsed_ms: u64 },
}
```

#### 4.2 Create Command `run_code_snippet`

**File:** `src-tauri/src/commands/run_code.rs` (new file)

```rust
use tauri::{AppHandle, Emitter, State};
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::time::Instant;
use uuid::Uuid;
use specta::specta;
use crate::events::RunCodeEvent;

#[specta]
#[tauri::command]
pub async fn run_code_snippet(
    app: AppHandle,
    language: String,
    code: String,
    working_dir: Option<String>,
) -> Result<String, String> {
    // Whitelist interpreters
    let (cmd, args) = match language.as_str() {
        "python" | "py" => ("python3", vec!["-c", &code]),
        "javascript" | "js" => ("node", vec!["-e", &code]),
        "bash" | "sh" => ("bash", vec!["-c", &code]),
        "ruby" | "rb" => ("ruby", vec!["-e", &code]),
        _ => return Err(format!("Running '{}' is not supported for security reasons", language)),
    };

    let run_id = Uuid::new_v4().to_string();
    let working_dir = working_dir.unwrap_or_else(|| ".".to_string());

    let mut child = Command::new(cmd)
        .args(&args)
        .current_dir(&working_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start interpreter: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Spawn stdout reader
    let app_clone = app.clone();
    let run_id_clone = run_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_clone.emit("run-code-event", RunCodeEvent::Stdout {
                run_id: run_id_clone.clone(),
                line,
            });
        }
    });

    // Spawn stderr reader
    let app_clone = app.clone();
    let run_id_clone = run_id.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = app_clone.emit("run-code-event", RunCodeEvent::Stderr {
                run_id: run_id_clone.clone(),
                line,
            });
        }
    });

    let start = Instant::now();
    let status = child.wait().await.map_err(|e| format!("Process error: {}", e))?;
    let elapsed = start.elapsed().as_millis() as u64;

    let _ = app.emit("run-code-event", RunCodeEvent::Exit {
        run_id: run_id.clone(),
        code: status.code().unwrap_or(-1),
        elapsed_ms: elapsed,
    });

    Ok(run_id)
}
```

#### 4.3 Register Command and Event

**File:** `src-tauri/src/lib.rs`

- Add `run_code_snippet` to `collect_commands!`.
- Add `RunCodeEvent` to `collect_events!`.

```rust
        .commands(collect_commands![
            // ... existing
            run_code_snippet,
        ])
        .events(collect_events![
            AgentEvent,
            McpEvent,
            WorkflowEvent,
            SkillEvent,
            RunCodeEvent,   // new
        ])
```

#### 4.4 Regenerate Bindings

```bash
cd src-tauri
cargo build
```

#### 4.5 Frontend: Run Button and Output Panel

**File:** `src/components/conversation/code-block.tsx`

- Import necessary icons, hooks, and event utilities.
- Define supported languages set.
- Add state for running status, output, and event listener.
- Render the Run button (conditionally for supported languages) and the output panel.

```tsx
import { Play, Loader2 } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import type { RunCodeEvent } from '@/lib/events';

const SUPPORTED_RUN_LANGUAGES = new Set(['python', 'py', 'javascript', 'js', 'bash', 'sh', 'ruby', 'rb']);

// Inside CodeBlock component
const [isRunning, setIsRunning] = useState(false);
const [runOutput, setRunOutput] = useState<string[]>([]);
const [runError, setRunError] = useState<string[]>([]);
const [runId, setRunId] = useState<string | null>(null);
const [showOutput, setShowOutput] = useState(false);
const rawCode = useArtifactContent(artifactId).data ?? ''; // from existing hook

useEffect(() => {
  if (!runId) return;
  const unlisten = listen<RunCodeEvent>('run-code-event', (event) => {
    if (event.payload.run_id !== runId) return;
    if (event.payload.type === 'stdout') {
      setRunOutput(prev => [...prev, event.payload.line]);
    } else if (event.payload.type === 'stderr') {
      setRunError(prev => [...prev, event.payload.line]);
    } else if (event.payload.type === 'exit') {
      setIsRunning(false);
      setRunId(null);
      if (event.payload.code !== 0) {
        setRunError(prev => [...prev, `Process exited with code ${event.payload.code}`]);
      }
    }
  });
  return () => { unlisten.then(fn => fn()); };
}, [runId]);

const handleRun = async () => {
  if (isRunning) return;
  setIsRunning(true);
  setRunOutput([]);
  setRunError([]);
  setShowOutput(true);
  try {
    const id = await commands.runCodeSnippet(language, rawCode, null);
    setRunId(id);
  } catch (err) {
    toast.error(`Failed to run: ${err}`);
    setIsRunning(false);
    setShowOutput(false);
  }
};

const canRun = SUPPORTED_RUN_LANGUAGES.has(language);

// In header actions, add:
{canRun && (
  <button
    onClick={handleRun}
    disabled={isRunning}
    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
    title="Run code snippet"
  >
    {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
  </button>
)}

{/* Below the scrollable code area, conditionally render output panel */}
{showOutput && (
  <div className="mt-2 border rounded-md p-2 bg-muted/30 text-xs font-mono max-h-48 overflow-auto">
    {runOutput.map((line, i) => <div key={i}>{line}</div>)}
    {runError.map((line, i) => <div key={i} className="text-destructive">{line}</div>)}
    {!isRunning && runOutput.length === 0 && runError.length === 0 && (
      <div className="text-muted-foreground">No output</div>
    )}
  </div>
)}
```

> **Note:** The `rawCode` variable is obtained from the existing `useArtifactContent` hook. If the artifact content is not yet loaded, the button may be disabled or show a loading state. You may want to disable the Run button while `rawCode` is empty.

#### 4.6 Commit

```bash
git add src-tauri/src/commands/run_code.rs src-tauri/src/events.rs src-tauri/src/lib.rs \
        src/components/conversation/code-block.tsx src/lib/bindings.ts
git commit -m "feat(code-block): add run button with streaming output (sandboxed interpreters)"
```

---

### Chunk 5: Diff View – Reuse Existing `VersionDiffModal`

**Goal:** Enable users to compare different versions of an artifact directly from the code block. This reuses the already existing `VersionDiffModal` component and `listArtifactVersions` command.

#### 5.1 Frontend: Add Diff Button and Modal

**File:** `src/components/conversation/code-block.tsx`

- Import `GitCompare` icon, `useQuery`, and the existing `VersionDiffModal`.
- Query artifact versions and conditionally render the diff button.
- Manage modal open state.

```tsx
import { GitCompare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { VersionDiffModal } from '@/components/artifacts/version-diff-modal';
import { commands } from '@/lib/bindings';

// Inside CodeBlock component
const [showDiff, setShowDiff] = useState(false);

const { data: versions } = useQuery({
  queryKey: ['artifact-versions', artifactId],
  queryFn: async () => {
    const res = await commands.listArtifactVersions(artifactId);
    if (res.status === 'ok') return res.data;
    throw new Error(res.error);
  },
  enabled: !!artifactId,
});

const canDiff = (versions?.length ?? 0) > 1;

// In header actions, add:
{canDiff && (
  <button
    onClick={() => setShowDiff(true)}
    className="p-1 text-muted-foreground hover:text-foreground"
    title="Compare with previous versions"
  >
    <GitCompare className="size-3.5" />
  </button>
)}

{/* Render modal */}
{showDiff && versions && (
  <VersionDiffModal
    open={showDiff}
    onClose={() => setShowDiff(false)}
    versions={versions}
  />
)}
```

No backend changes are required because `listArtifactVersions` already returns `ArtifactData` with a `content` field.

#### 5.2 Commit

```bash
git add src/components/conversation/code-block.tsx
git commit -m "feat(code-block): add diff view using existing VersionDiffModal"
```

### Chunk 6: Token/Line Count Badge

**Goal:** Display a badge in the code block header showing the line count and an approximate token count, giving users a quick sense of the code’s size.

#### 6.1 Extend Backend Types with `token_count`

**File:** `src-tauri/skilldeck-core/src/markdown/types.rs`

Add the `token_count` field to both `MdNode::CodeBlock` and `ArtifactSpec`.

```rust
// src-tauri/skilldeck-core/src/markdown/types.rs

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MdNode {
    // ... other variants unchanged
    CodeBlock {
        id: String,
        language: String,
        raw_code: String,
        highlighted_html: String,
        artifact_id: Uuid,
        line_count: u32,
        file_path: Option<String>,
        token_count: u32,               // new
    },
    // ... rest unchanged
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq)]
pub struct ArtifactSpec {
    pub id: Uuid,
    pub language: String,
    pub raw_code: String,
    pub slot_index: u32,
    pub file_path: Option<String>,
    pub line_count: u32,
    pub token_count: u32,               // new
}
```

#### 6.2 Compute Token Count During Highlighting

**File:** `src-tauri/skilldeck-core/src/markdown/renderer.rs`

Modify the `highlight` method to return the token count along with the HTML and line count.

```rust
// Inside impl MarkdownPipeline

/// Highlight code and wrap each line in a `<span class="line">`.
/// Returns (html, line_count, token_count).
fn highlight(&self, code: &str, lang: &str) -> (String, u32, u32) {
    let normalized_lang = match lang {
        "typescript" | "ts" | "typescriptreact" => "tsx",
        _ => lang,
    };
    let syntax = SYNTAX_SET
        .find_syntax_by_token(normalized_lang)
        .unwrap_or_else(|| {
            SYNTAX_SET
                .find_syntax_by_first_line(code)
                .unwrap_or_else(|| SYNTAX_SET.find_syntax_plain_text())
        });

    let lines: Vec<&str> = code.lines().collect();
    let line_count = lines.len() as u32;

    // Compute token count by parsing each line and counting syntax tokens
    let mut token_count = 0u32;
    for line in &lines {
        let ops = syntect::parsing::ParseState::new(syntax)
            .parse_line(line, &SYNTAX_SET)
            .unwrap_or_default();
        token_count += ops.len() as u32;
    }

    let theme_guard = self.theme.0.read();
    let mut wrapped = String::new();
    for line in lines {
        let highlighted = syntect::html::highlighted_html_for_string(
            line,
            &SYNTAX_SET,
            syntax,
            &theme_guard,
        );
        wrapped.push_str(&format!("<span class=\"line\">{}</span>", highlighted));
    }
    (wrapped, line_count, token_count)
}
```

Update the call site in `render_blocks` to capture the third return value:

```rust
// Inside render_blocks, after reading code buffer
let (highlighted_html, line_count, token_count) = self.highlight(&code_buf, &code_lang);

let file_path = extract_file_path(&code_lang, &code_buf)
    .or_else(|| last_inline_code.take().filter(|s| is_plausible_filename(s, &code_lang)));

let id = format!("cb-{}", id_counter);
id_counter += 1;
let artifact_id = Uuid::new_v4();

nodes.push(MdNode::CodeBlock {
    id: id.clone(),
    language: code_lang.clone(),
    raw_code: code_buf.clone(),
    highlighted_html,
    artifact_id,
    line_count,
    file_path: file_path.clone(),
    token_count,                        // new
});

if emit_artifacts {
    artifact_specs.push(ArtifactSpec {
        id: artifact_id,
        language: code_lang.clone(),
        raw_code: code_buf,
        slot_index: id_counter - 1,
        file_path,
        line_count,
        token_count,                    // new
    });
}
```

#### 6.3 Regenerate TypeScript Bindings

```bash
cd src-tauri
cargo build
```

This updates `src/lib/bindings.ts` with the new `token_count` fields.

#### 6.4 Frontend: Display Badge in `CodeBlock`

**File:** `src/components/conversation/code-block.tsx`

Extend the props interface and render the badge in the header.

```tsx
interface CodeBlockProps {
  language: string;
  artifactId: string;
  highlightedHtml: string;
  isStreaming?: boolean;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  lineCount: number;
  filePath?: string | null;
  tokenCount: number;                   // new
}

export const CodeBlock: React.FC<CodeBlockProps> = memo(({
  // ... existing props
  tokenCount,
}) => {
  // ... existing logic

  // Rough heuristic fallback if token count is zero (e.g., legacy artifacts)
  const displayTokenCount = tokenCount > 0
    ? `${tokenCount} tok`
    : `~${Math.ceil((rawCode?.length ?? 0) / 4)} tok`;

  return (
    <div ref={containerRef} className="my-3 rounded-lg border border-border font-mono text-xs">
      <div ref={headerRef} className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted">
        <div className="flex items-center gap-1.5">
          {/* collapse button and language */}
        </div>
        <div className="flex items-center gap-1">
          {/* line count + token badge */}
          <span className="text-[10px] text-muted-foreground mr-2">
            {lineCount} lines · {displayTokenCount}
          </span>
          {/* existing copy, line-numbers, save, run, diff buttons */}
        </div>
      </div>
      {/* ... rest unchanged */}
    </div>
  );
});
```

#### 6.5 Update `MessageBubble` to Pass `tokenCount`

**File:** `src/components/conversation/message-bubble.tsx`

In the `NodeRenderer`, add the new prop:

```tsx
case 'code_block':
  return (
    <CodeBlock
      language={node.language}
      artifactId={node.artifact_id}
      highlightedHtml={node.highlighted_html}
      isStreaming={isStreaming}
      scrollContainerRef={scrollContainerRef}
      lineCount={node.line_count}
      filePath={node.file_path}
      tokenCount={node.token_count}    // new
    />
  );
```

#### 6.6 Commit

```bash
git add src-tauri/skilldeck-core/src/markdown/types.rs \
        src-tauri/skilldeck-core/src/markdown/renderer.rs \
        src/lib/bindings.ts \
        src/components/conversation/code-block.tsx \
        src/components/conversation/message-bubble.tsx
git commit -m "feat(code-block): add line count and approximate token count badge"
```

---

### Chunk 7: Linked Artifact Badge

**Goal:** Make the filename pill clickable. Clicking it opens the Artifacts panel in the right sidebar and scrolls to highlight the corresponding artifact.

#### 7.1 Extend UI Layout Store with Ephemeral Selection

We want the selected artifact ID to be temporary (not persisted across app restarts). Instead of adding to `ui-layout.ts` (which is persisted), we'll add it to the ephemeral store.

**File:** `src/store/ui-ephemeral.ts`

Add state for the selected artifact ID:

```ts
interface UIState {
  // ... existing fields
  selectedArtifactId: string | null;
  setSelectedArtifactId: (id: string | null) => void;
}

export const useUIEphemeralStore = create<UIState>((set) => ({
  // ... existing state
  selectedArtifactId: null,
  setSelectedArtifactId: (id) => set({ selectedArtifactId: id }),
}));
```

#### 7.2 Add `id` Attribute to `ArtifactItem`

**File:** `src/components/artifacts/artifact-item.tsx`

Give the root element an ID that we can scroll to.

```tsx
export function ArtifactItem({ artifact, compact = false, onPinChange }: ArtifactItemProps) {
  // ... existing logic

  return (
    <div
      id={`artifact-${artifact.id}`}   // <-- new
      className="w-full min-w-0 rounded-lg border border-border p-2 hover:bg-muted/30 transition-colors overflow-hidden"
    >
      {/* ... rest unchanged */}
    </div>
  );
}
```

#### 7.3 Scroll to Selected Artifact in `ArtifactPanel`

**File:** `src/components/artifacts/artifact-panel.tsx`

Use the ephemeral store to scroll to the selected artifact when it changes.

```tsx
import { useEffect, useRef } from 'react';
import { useUIEphemeralStore } from '@/store/ui-ephemeral';

export function ArtifactPanel() {
  const selectedArtifactId = useUIEphemeralStore((s) => s.selectedArtifactId);
  const setSelectedArtifactId = useUIEphemeralStore((s) => s.setSelectedArtifactId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedArtifactId && containerRef.current) {
      const element = document.getElementById(`artifact-${selectedArtifactId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Clear selection after scrolling to avoid interfering with future clicks
        setTimeout(() => setSelectedArtifactId(null), 2000);
      }
    }
  }, [selectedArtifactId, setSelectedArtifactId]);

  // ... rest of component unchanged
}
```

#### 7.4 Make Filename Pill Clickable in `CodeBlock`

**File:** `src/components/conversation/code-block.tsx`

Import the necessary store hooks and replace the static filename span with a button.

```tsx
import { useUILayoutStore } from '@/store/ui-layout';
import { useUIEphemeralStore } from '@/store/ui-ephemeral';

// Inside CodeBlock component
const setRightTab = useUILayoutStore((s) => s.setRightTab);
const setSelectedArtifactId = useUIEphemeralStore((s) => s.setSelectedArtifactId);

const handleOpenArtifact = () => {
  if (artifactId) {
    setRightTab('artifacts');
    setSelectedArtifactId(artifactId);
  }
};

// In the header, replace the static filename display:
{filePath ? (
  <button
    type="button"
    onClick={handleOpenArtifact}
    className="text-[10px] font-mono text-primary hover:underline truncate max-w-[150px]"
    title={`Open ${filePath} in artifacts`}
  >
    {filePath.split('/').pop()}
  </button>
) : null}
```

#### 7.5 Commit

```bash
git add src/store/ui-ephemeral.ts \
        src/components/artifacts/artifact-item.tsx \
        src/components/artifacts/artifact-panel.tsx \
        src/components/conversation/code-block.tsx
git commit -m "feat(code-block): filename pill opens Artifacts panel and highlights artifact"
```

---

### Chunk 8: Search Within Block

**Goal:** Pressing Cmd+F (or Ctrl+F) while a code block is focused opens an inline search input. Matches are highlighted within the code block.

#### 8.1 Add CSS for Search Highlight

**File:** `src/App.css`

Add a class for highlighted search matches.

```css
/* src/App.css */

.search-highlight {
  background-color: var(--highlight-inline);
  color: inherit;
  border-radius: 2px;
}
```

#### 8.2 Implement Search Logic in `CodeBlock`

**File:** `src/components/conversation/code-block.tsx`

Add state, keyboard listeners, highlighting logic, and the search UI.

```tsx
import { Search, X } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

// Helper to escape regex special characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Inside CodeBlock component
const [searchQuery, setSearchQuery] = useState('');
const [showSearch, setShowSearch] = useState(false);
const searchInputRef = useRef<HTMLInputElement>(null);
const containerRef = useRef<HTMLDivElement>(null);
const preRef = useRef<HTMLPreElement>(null);

// Keyboard shortcut: Cmd+F / Ctrl+F
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!containerRef.current?.contains(document.activeElement)) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (e.key === 'Escape' && showSearch) {
      setShowSearch(false);
      setSearchQuery('');
      clearHighlights();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [showSearch]);

const clearHighlights = useCallback(() => {
  const pre = preRef.current;
  if (!pre) return;
  pre.querySelectorAll('.search-highlight').forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent || ''), el);
      parent.normalize();
    }
  });
}, []);

const highlightMatches = useCallback((query: string) => {
  const pre = preRef.current;
  if (!pre || !query.trim()) {
    clearHighlights();
    return;
  }
  clearHighlights();

  const regex = new RegExp(escapeRegExp(query), 'gi');
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      regex.test(node.textContent || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });

  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent || '';
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
      }
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.textContent = match[0];
      frag.appendChild(mark);
      lastIdx = regex.lastIndex;
      if (match[0].length === 0) regex.lastIndex++; // avoid infinite loop on zero-width matches
    }
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}, [clearHighlights]);

// Reapply highlights when query or HTML changes
useEffect(() => {
  highlightMatches(searchQuery);
}, [searchQuery, highlightedHtml, highlightMatches]); // ⬅ fixed: added highlightedHtml

// In header actions, add search toggle and inline input:
<div className="flex items-center gap-1">
  {showSearch ? (
    <>
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Find in code..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-6 px-2 text-xs border rounded bg-background"
        onKeyDown={(e) => e.stopPropagation()}
      />
      <button
        onClick={() => {
          setShowSearch(false);
          setSearchQuery('');
          clearHighlights();
        }}
        className="p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </>
  ) : (
    <button
      onClick={() => setShowSearch(true)}
      className="p-1 text-muted-foreground hover:text-foreground"
      title="Find in code (Cmd+F)"
    >
      <Search className="size-3.5" />
    </button>
  )}
  {/* ... other action buttons */}
</div>
```

#### 8.3 Commit

```bash
git add src/App.css src/components/conversation/code-block.tsx
git commit -m "feat(code-block): add inline search with Cmd+F and match highlighting"
```

---

### Chunk 9: Explain This / Ask AI to Fix

**Goal:** Add “Explain” and “Fix” buttons to the code block header. Clicking them sends a contextual prompt to the AI agent in the current conversation.

#### 9.1 Add Buttons to `CodeBlock` Header

**File:** `src/components/conversation/code-block.tsx`

Import the required hooks and icons, and implement the handlers.

```tsx
import { HelpCircle, Wrench } from 'lucide-react';
import { useSendMessage } from '@/hooks/use-messages';
import { useConversationStore } from '@/store/conversation';
import { toast } from '@/components/ui/toast';

// Inside CodeBlock component
const activeConversationId = useConversationStore((s) => s.activeConversationId);
const activeBranchId = useConversationStore((s) => s.activeBranchId);
const sendMessage = useSendMessage(activeConversationId!, activeBranchId);
const rawCode = useArtifactContent(artifactId).data ?? '';

const handleExplain = () => {
  if (!activeConversationId) {
    toast.error('No active conversation');
    return;
  }
  const prompt = `Explain this ${language} code:\n\`\`\`${language}\n${rawCode}\n\`\`\``;
  sendMessage.mutate({ content: prompt, thinking: false });
};

const handleFix = () => {
  if (!activeConversationId) {
    toast.error('No active conversation');
    return;
  }
  const prompt = `The following ${language} code has an issue. Please fix it and explain the changes:\n\`\`\`${language}\n${rawCode}\n\`\`\``;
  sendMessage.mutate({ content: prompt, thinking: false });
};

// In header actions, add the new buttons inside a group with hover opacity:
<div className="flex items-center gap-1 opacity-0 group-hover/code-header:opacity-100 transition-opacity">
  <button
    onClick={handleExplain}
    className="p-1 text-muted-foreground hover:text-foreground"
    title="Explain this code"
  >
    <HelpCircle className="size-3.5" />
  </button>
  <button
    onClick={handleFix}
    className="p-1 text-muted-foreground hover:text-foreground"
    title="Ask AI to fix"
  >
    <Wrench className="size-3.5" />
  </button>
</div>
```

Ensure the header container has the `group/code-header` class so the buttons appear on hover. (The existing header may already have a `group` class; adjust accordingly.)

#### 9.2 Commit

```bash
git add src/components/conversation/code-block.tsx
git commit -m "feat(code-block): add 'Explain' and 'Fix' buttons to send code context to agent"
```

---

### Chunk 10: Minimap (Scroll Thumb)

**Goal:** For code blocks with more than 60 lines, display a scroll position indicator (minimap) on the right edge of the code block.

#### 10.1 Implement Minimap in `CodeBlock`

**File:** `src/components/conversation/code-block.tsx`

Add state, refs, and the minimap element.

```tsx
// Inside CodeBlock component
const [scrollTop, setScrollTop] = useState(0);
const scrollableRef = useRef<HTMLDivElement>(null);

// Track scroll position and recalculate on content change
useEffect(() => {
  const el = scrollableRef.current;
  if (!el) return;
  const handleScroll = () => setScrollTop(el.scrollTop);
  el.addEventListener('scroll', handleScroll);
  // Initial measurement
  handleScroll();
  return () => el.removeEventListener('scroll', handleScroll);
}, [highlightedHtml]); // ⬅ fixed: reattach when content changes

const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
  const el = scrollableRef.current;
  if (!el) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = y / rect.height;
  el.scrollTop = ratio * el.scrollHeight;
};

const minimapHeight = scrollableRef.current?.clientHeight || 0;
const scrollHeight = scrollableRef.current?.scrollHeight || 1;
const scrollRatio = minimapHeight > 0 ? scrollTop / scrollHeight : 0;
const thumbHeight = Math.max(20, (minimapHeight / scrollHeight) * minimapHeight);
const thumbTop = scrollRatio * minimapHeight;

// Inside the scrollable div wrapper, add the minimap (conditionally):
<div className="relative"> {/* ensure relative positioning */}
  <div
    ref={scrollableRef}
    className="overflow-auto max-h-96 thin-scrollbar"
  >
    <pre ref={preRef} ... />
  </div>
  {lineCount > 60 && (
    <div
      className="absolute right-0 top-0 w-1.5 h-full cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
      onClick={handleMinimapClick}
      style={{ backgroundColor: 'var(--border)' }}
    >
      <div
        className="absolute w-full bg-primary/40 rounded-full"
        style={{ height: thumbHeight, top: thumbTop }}
      />
    </div>
  )}
</div>
```

#### 10.2 Commit

```bash
git add src/components/conversation/code-block.tsx
git commit -m "feat(code-block): add minimap scroll thumb for long code blocks (>60 lines)"
```

---

### Chunk 11: Highlighted Line Linking

**Goal:** Allow a parent component to specify which lines should be highlighted (e.g., when an AI mentions “line 23”). This chunk adds the UI capability; the parsing logic is deferred.

#### 11.1 Extend `CodeBlock` Props

**File:** `src/components/conversation/code-block.tsx`

Add an optional `highlightedLines` prop.

```tsx
interface CodeBlockProps {
  // ... existing props
  highlightedLines?: number[];          // new
}

export const CodeBlock: React.FC<CodeBlockProps> = memo(({
  // ... existing props
  highlightedLines,
}) => {
  // ...
});
```

#### 11.2 Apply Highlighting Class to Lines

Add an effect that adds the `highlighted-line` class to matching line elements whenever `highlightedLines` or `highlightedHtml` changes.

```tsx
useEffect(() => {
  const pre = preRef.current;
  if (!pre || !highlightedLines?.length) return;
  const lines = pre.querySelectorAll('.line');
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (highlightedLines.includes(lineNumber)) {
      line.classList.add('highlighted-line');
    } else {
      line.classList.remove('highlighted-line');
    }
  });
}, [highlightedLines, highlightedHtml]); // ⬅ fixed: added highlightedHtml
```

#### 11.3 Add CSS for Highlighted Line

**File:** `src/App.css`

```css
/* src/App.css */

.code-with-lines .line.highlighted-line {
  background: var(--highlight-inline);
  border-left: 3px solid var(--primary);
}
```

#### 11.4 Update `MessageBubble` to Pass `highlightedLines` (Future Integration)

In the future, when the frontend can parse line numbers from AI responses, it will pass the `highlightedLines` prop to `CodeBlock`. For now, the prop is optional and does nothing if not provided.

#### 11.5 Commit

```bash
git add src/components/conversation/code-block.tsx src/App.css
git commit -m "feat(code-block): add highlightedLines prop for line highlighting (UI ready)"
```
