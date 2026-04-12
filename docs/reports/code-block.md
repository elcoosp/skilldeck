Having read the Rust backend, here's the full picture — `ArtifactSpec` already carries `file_path` and `raw_code`, `MdNode::CodeBlock` has `highlighted_html` from syntect, and the pipeline runs syntect with `ClassStyle::Spaced` meaning the HTML uses CSS classes not inline styles. This is important for every feature below.

---

## Line numbers — full implementation plan

This is the only one getting code since it touches both layers.

**Rust side — `renderer.rs`**

Syntect with `ClassStyle::Spaced` produces `<span class="...">token</span>` groups but doesn't wrap individual lines. You need to post-process the highlighted HTML to wrap each line in a `<span class="line">` element. Do this in `render_partial` after syntect emits the HTML, before storing in `MdNode::CodeBlock`:

```rust
fn wrap_lines(html: &str) -> String {
    // syntect emits a <pre> wrapper — work inside it
    // Split on newlines, wrap each in <span class="line">, rejoin
    // Handle the final empty line syntect adds
    let lines: Vec<&str> = html.split('\n').collect();
    let wrapped: Vec<String> = lines
        .iter()
        .enumerate()
        .map(|(i, line)| {
            format!(
                r#"<span class="line" data-line="{}">{}</span>"#,
                i + 1,
                line
            )
        })
        .collect();
    wrapped.join("\n")
}
```

Call this on the inner content of the `<pre>` block before storing `highlighted_html`.

Also add `line_count: u32` to `MdNode::CodeBlock` and `ArtifactSpec` — compute it from `raw_code.lines().count()` at render time. This lets the frontend show the count badge without parsing HTML.

```rust
// types.rs — add to CodeBlock variant and ArtifactSpec
pub line_count: u32,
```

**Frontend side — `code-block.tsx`**

CSS counter approach — line numbers are purely presentational, never copied:

```css
/* globals.css */
.code-with-lines {
  counter-reset: line;
}
.code-with-lines .line {
  display: block;
  position: relative;
  padding-left: 3.5rem;  /* room for number */
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
  /* Optional: subtle right border as gutter divider */
  border-right: 1px solid var(--border);
}
/* Highlighted line (for AI "see line X" feature) */
.code-with-lines .line.highlighted {
  background: var(--highlight-inline);
}
```

In the component, add a `showLineNumbers` prop defaulting to `true` for blocks > 3 lines (use `line_count` from the node), and apply `code-with-lines` class to the `<pre>`:

```tsx
<pre
  className={cn("p-4 m-0 text-xs leading-relaxed", showLineNumbers && "code-with-lines")}
  ...
/>
```

Add a toggle button in the header (hash icon `#`) to let users toggle line numbers. Store preference in `localStorage` keyed by language so Python blocks remember differently from shell blocks.

---

## All other features — plan only

### Apply to file

`ArtifactSpec.file_path` is already parsed from first-line comments in your Rust code. On the frontend, read `file_path` from the `CodeBlock` node prop. If present, show a "Save to file" button in the header alongside copy. On click, call a Tauri command `write_artifact_to_path(artifact_id, file_path)` — you already have filesystem access via the opener plugin. If `file_path` is null, show a file picker dialog instead. After writing, show a brief "Saved" confirmation in place of the button.

The Rust command just needs: resolve the path relative to the active workspace, write `raw_code`, return the absolute path written.

---

### Diff view

When the AI regenerates code for the same `file_path`, the new `ArtifactSpec` will have the same `file_path` as a previous one in the conversation. The frontend already has `useArtifactContent(artifactId)` — extend this hook or add `usePreviousArtifact(filePath)` that finds the last artifact with the same `file_path` in conversation history.

On the Rust side, add a Tauri command `diff_highlighted(old_html, new_html) -> DiffResult` that returns line-level diff metadata (added/removed/unchanged per line). Or do it purely on the frontend with a small diff library since you have both `raw_code` strings available.

Render: replace the normal `<pre>` with two-column or unified diff view. Green `bg` on added lines, red on removed, using `data-line` attributes from the wrapped lines.

A toggle button in the header switches between "diff" and "full" view. Only shown when a previous version exists.

---

### Run button

Tauri gives you `std::process::Command`. Add a `run_code_snippet(language, code, working_dir) -> RunResult` command to the backend. Support `python3`, `node`, `bash`/`sh` initially — detectable from the `language` field already in `MdNode::CodeBlock`.

`RunResult` streams stdout/stderr back via a Tauri event channel (same pattern as your streaming markdown — you already have this infrastructure in `streaming.rs`). On the frontend, show a collapsible output panel below the code block that appears when Run is clicked. Stream output lines into it. Show exit code and elapsed time when done.

Gate the button: only show for `python`, `javascript`, `typescript`, `bash`, `sh`, `ruby`. Never for `html`, `css`, `json`, `sql` etc.

---

### Token/line count badge

`line_count` is now on the node (from the plan above). For token count, add `token_count: u32` to `ArtifactSpec` computed in the Rust renderer — syntect already tokenizes the code, so counting tokens during highlighting costs nothing. Or approximate client-side: `Math.ceil(raw_code.length / 4)`.

Render as a muted pill in the header between the language label and the action buttons: `42 lines · ~320 tok`. Only show when the block is not collapsed. No interaction needed.

---

### Linked artifact badge

You already have `artifact_id: Uuid` on `MdNode::CodeBlock`. The `ArtifactSpec.file_path` gives you a display name. Show a pill in the header: `📄 App.tsx` (or just the filename without icon). Clicking it opens the artifact panel and selects that artifact. You already have `ArtifactPanel` — just emit a store event or call a context function to select by ID.

---

### Search within block

A controlled input that appears in the header when `Cmd+F` is pressed while the code block is focused (use a `keydown` listener on the container div). The search scans `raw_code` for matches, maps match positions to line numbers, then adds/removes a `search-match` class to `.line` elements whose `data-line` attribute matches. CSS handles the highlight color. Navigate matches with Enter/Shift+Enter. Escape closes and clears.

No backend needed — all frontend, all CSS classes.

---

### Explain this / Ask AI to fix

Two ghost icon buttons in the header, only visible on hover (`opacity-0 group-hover:opacity-100`). "Explain" sends `sendMessage("Explain this ${language} code: \n\`\`\`${language}\n${raw_code}\n\`\`\`")` to your existing message send function. "Fix" only appears when the AI's response includes error markers — you can detect this by checking if `highlighted_html` contains syntect's error class (`syntect` marks parse errors with a specific span class).

---

### Filename in header

Already available — `ArtifactSpec.file_path` is populated by your Rust renderer from first-line comments. Pass it through `MdNode::CodeBlock` as an optional field (add `file_path: Option<String>` to the variant — it's already on `ArtifactSpec`, just mirror it onto the node). Display as a `font-mono text-[10px]` pill before the language pill. Truncate to basename only: `path.split('/').pop()`.

---

### Wrap toggle

Button in header (↩ icon). Toggle `whiteSpace` between `'pre'` and `'pre-wrap'` on the `<pre>` element via React state. Persist per-block preference in a `useLocalStorage` hook keyed by `artifactId`. Default `pre` (no wrap).

---

### Minimap

Only for `line_count > 60`. A 3px-wide absolutely positioned strip on the right edge of the scrollable div. Render a canvas element the same height as the scroll container. Draw the highlighted lines as colored 1px bands using the syntect token colors — you can extract color info from the HTML spans. The scroll thumb is a semi-transparent rect. On mousedown on the minimap, set `scrollable.scrollTop` proportionally. This is a self-contained canvas component that takes `highlightedHtml` and `scrollTop` as props.

---

### Highlighted line linking

Add `highlightedLines?: number[]` prop to `CodeBlock`. When set, add the `highlighted` CSS class to matching `.line[data-line="N"]` elements after render via a `useEffect` that queries the `preRef`. The AI response parser can extract "see line 23" patterns and pass line numbers through the `MdNode::CodeBlock` variant — add `highlighted_lines: Vec<u32>` to the Rust type, defaulting to empty. The renderer leaves it empty; the frontend conversation renderer could populate it by parsing the surrounding prose for line references.
