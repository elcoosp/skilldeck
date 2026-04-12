## Code block feature brainstorm

### Line numbers — yes, but do it right

Don't inject them via JS counting — generate them from the highlighted HTML at render time. The trick is a CSS counter on the `<pre>` so line numbers are display-only and never copied to clipboard:

```css
.code-with-lines .line::before {
  counter-increment: line;
  content: counter(line);
  /* styled, non-selectable */
  user-select: none;
  -webkit-user-select: none;
}
```

This means copy still gets clean code, and the numbers don't interfere with the syntax theme.

---

### High-impact features for an AI chat context specifically

**Diff view** — when the AI edits code it previously generated, show a `+/-` diff instead of the full block. Green lines added, red lines removed. This is uniquely valuable in chat because you're often iterating on the same file across multiple messages. Trigger it by comparing `artifactId` content across messages.

**"Apply to file" button** — since this is a desktop Tauri app with filesystem access, a one-click button that writes the code to a file path the user specifies (or remembers from context). You already have `revealItemInDir` in your codebase — you likely have write access too. This is the killer feature no web-based chat app can do.

**Run button** — for shell scripts, Python, JS snippets. Execute directly in a terminal pane. Tauri gives you process spawning. Output streams back into the chat or a mini terminal below the block.

**Token/line count badge** — show `42 lines · ~320 tokens` in the header. Useful for the user to understand how much context the code consumes, relevant for AI conversations where context window matters.

**Linked artifact badge** — if the code block has an `artifactId`, show a small chip like `artifact: ui-component.tsx` that opens the artifact panel. You already have this plumbing via `useArtifactContent`.

**Smart copy variants** — long-press or right-click the copy button to reveal: "Copy code", "Copy as markdown fence", "Copy with filename comment". Small but useful.

**Minimap for long blocks** — a 2px-wide vertical strip on the right showing a compressed view of the code, with a highlight showing your scroll position. Like VS Code's minimap but minimal. Only render for blocks > 60 lines.

**Search within block** — `Cmd+F` while focused opens a tiny inline search bar in the header. Highlights matches in the pre content. Essential for long blocks.

**Fold regions** — if the syntax highlighter identifies functions/classes, add collapse chevrons at the start of each block. Lets users hide implementation details they don't care about.

**Language-aware "explain this" button** — a small `?` button that sends the code back to the AI with "explain this [language] code" pre-filled. One click to understand generated code.

**Error highlighting** — if the AI generates code with a known syntax error (detectable from the highlighter parse), add a red gutter indicator on the offending line and an inline "Ask AI to fix" button.

**Shared line highlight** — when the AI says "see line 23", it could pass metadata that highlights that line in the rendered block. Deep link from prose to code.

---

### Lower effort but high polish

- **Filename in header** — if context contains a filename (AI said "here's `App.tsx`"), extract and show it as a pill alongside the language label
- **"Changed" indicator** — if this is a re-generation of a previous artifact, show a small amber dot on the header indicating the content changed
- **Wrap toggle** — a `↩` button in the header to toggle `white-space: pre` vs `pre-wrap`. Some users want wrapping, some don't
- **Focus mode** — clicking an expand icon opens the code block in a full-screen overlay with proper IDE-width line lengths and more scrollable area
- **Keyboard shortcut hint** — `⌘C` shown faintly in the header on hover, disappears after first use

---

### The three I'd prioritize

1. **Apply to file** — unique to desktop, zero other chat apps have it, directly solves the copy-paste friction loop
2. **Diff view** — transforms the "regenerate" workflow from opaque to transparent
3. **Line numbers + line highlight linking** — foundational for all the AI "see line X" references that will naturally come from the model
