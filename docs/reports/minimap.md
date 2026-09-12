# Plan: Replace Broken JS Minimap with Syntect‑Powered Canvas Minimap

## 1. Problem Statement

The current `CodeBlock` component uses a fragile CSS‑based minimap (`minimap-strip` div) that:

- Does **not** reflect syntax colours – it’s a uniform grey strip.
- Causes layout thrashing and incorrect thumb positioning.
- Relies on manual DOM calculations that often break on window resize or font changes.

We need a **fast, accurate, interactive minimap** that:

- Shows real syntax‑highlighted colours per line.
- Works for both stable (persisted) and streaming code blocks.
- Supports click‑to‑scroll and draggable thumb with zero per‑scroll layout calculations.
- Is pre‑computed on the Rust side using the same `syntect` engine as the main code view.

## 2. Overview of the Solution

We will extend the existing markdown pipeline to generate a **minimap RGBA buffer** for every code block. The buffer will be a flat `Vec<u8>` of RGBA pixels, where each character occupies a small fixed block (e.g. 2×2 or 3×3 pixels). The frontend will receive this buffer and paint it onto a `<canvas>` once. Scroll synchronisation will be implemented by drawing a semi‑transparent thumb on the same canvas on every scroll event – a cheap `fillRect` operation.

## 3. Detailed Implementation Steps

### 3.1 Extend the `MdNode::CodeBlock` Type

**File:** `skilldeck-core/src/markdown/types.rs`

Add three new fields to the `CodeBlock` variant:

```rust
CodeBlock {
    // ... existing fields ...
    pub minimap_rgba: Vec<u8>,    // flat RGBA, width * height * 4
    pub minimap_width: u32,
    pub minimap_height: u32,
}
```

Also update the `NodeDocument` serialisation – no extra changes needed because `specta` derives automatically handle the new fields.

### 3.2 Implement Minimap Generation in the Markdown Pipeline

**File:** `skilldeck-core/src/markdown/renderer.rs`

#### 3.2.1 Helper: Character → Pixel Block

Add a function that, given a line of code, its syntax tokens, and a theme, fills a rectangular block in the RGBA buffer for each character.

```rust
fn fill_block(
    rgba: &mut [u8],
    line_idx: u32,
    char_col: u32,
    char_w: u32,
    char_h: u32,
    full_width: u32,
    color: syntect::highlighting::Color,
) {
    let start_x = char_col * char_w;
    let start_y = line_idx * char_h;
    for dy in 0..char_h {
        for dx in 0..char_w {
            let px_x = start_x + dx;
            let px_y = start_y + dy;
            if px_x < full_width && px_y * full_width * 4 + 4 <= rgba.len() as u32 {
                let idx = ((px_y * full_width + px_x) * 4) as usize;
                rgba[idx] = color.r;
                rgba[idx+1] = color.g;
                rgba[idx+2] = color.b;
                rgba[idx+3] = color.a;
            }
        }
    }
}
```

#### 3.2.2 Main Minimap Generator

In `renderer.rs`, add:

```rust
fn minimap_from_lines(
    lines: &[&str],
    syntax: &syntect::parsing::SyntaxDefinition,
    theme: &syntect::highlighting::Theme,
    char_width_px: u32,
    char_height_px: u32,
    max_width_chars: u32,
) -> (Vec<u8>, u32, u32) {
    if lines.is_empty() {
        return (vec![], 0, 0);
    }

    let image_width = max_width_chars * char_width_px;
    let image_height = lines.len() as u32 * char_height_px;
    let mut rgba = vec![0u8; (image_width * image_height * 4) as usize];

    for (line_idx, &line) in lines.iter().enumerate() {
        let mut parse_state = syntect::parsing::ParseState::new(syntax);
        let ops = parse_state.parse_line(line, &SYNTAX_SET).unwrap_or_default();
        let mut col = 0;
        let mut pos = 0;

        for (start, end, style_idx) in ops {
            if start > pos {
                let default_fg = theme.settings.foreground.unwrap_or(syntect::highlighting::Color::WHITE);
                let len = start - pos;
                for _ in 0..len {
                    if col < max_width_chars {
                        fill_block(&mut rgba, line_idx as u32, col, char_width_px, char_height_px, image_width, default_fg);
                        col += 1;
                    }
                }
                pos = start;
            }

            let style = theme.styles[style_idx as usize];
            let fg = style.foreground;
            let token_len = end - start;
            for _ in 0..token_len {
                if col < max_width_chars {
                    fill_block(&mut rgba, line_idx as u32, col, char_width_px, char_height_px, image_width, fg);
                    col += 1;
                }
            }
            pos = end;
        }

        // Fill any remaining characters after last token (should rarely happen)
        if pos < line.len() {
            let default_fg = theme.settings.foreground.unwrap_or(syntect::highlighting::Color::WHITE);
            for _ in pos..line.len() {
                if col < max_width_chars {
                    fill_block(&mut rgba, line_idx as u32, col, char_width_px, char_height_px, image_width, default_fg);
                    col += 1;
                }
            }
        }
    }

    (rgba, image_width, image_height)
}
```

**Design choices**:

- `char_width_px = 2`, `char_height_px = 2` – gives a crisp minimap without being too heavy.
- `max_width_chars = 100` – matches the wrap limit used by Faiyels; characters beyond 100 are ignored (no overflow handling needed).
- Tokens are iterated exactly as in `highlighted_html_for_string`, so the minimap and the main HTML share the same colour logic.

#### 3.2.3 Integrate into `highlight` method

Inside `MarkdownPipeline::highlight`, after obtaining `lines` and the syntax, generate the minimap and store it in the `CodeBlock` node.

```rust
let (minimap_rgba, minimap_width, minimap_height) = minimap_from_lines(
    &lines,
    syntax,
    theme,
    2,   // char_width_px
    2,   // char_height_px
    100, // max_width_chars
);

// later when pushing the node:
nodes.push(MdNode::CodeBlock {
    // ... existing fields ...
    minimap_rgba,
    minimap_width,
    minimap_height,
});
```

**Note:** The minimap is generated **once** for each code block. For streaming code blocks, the minimap will be generated only when the final document is persisted (because `IncrementalStream` only emits final documents). This is acceptable – streaming minimaps would flicker anyway. We will skip minimap generation for draft nodes by passing `emit_artifacts = false` in the streaming pipeline (already done in `streaming.rs`).

### 3.3 Update the Frontend `CodeBlock` Component

**File:** `src/components/conversation/code-block.tsx`

#### 3.3.1 Add Minimap Props

Extend the `CodeBlockProps` interface:

```tsx
interface CodeBlockProps {
  // ... existing ...
  minimapRgba?: Uint8Array;
  minimapWidth?: number;
  minimapHeight?: number;
}
```

#### 3.3.2 Render a Canvas Instead of the Broken `div`

Replace the current minimap block (lines ~586–602) with a `<canvas>` element:

```tsx
{showMinimap && minimapRgba && (
  <div
    className="absolute right-0 top-0 w-[200px] h-full cursor-pointer"
    onClick={handleMinimapClick}
  >
    <canvas
      ref={minimapCanvasRef}
      width={minimapWidth}
      height={minimapHeight}
      className="w-full h-full object-cover"
    />
    {/* Thumb will be drawn on the canvas itself, not as a separate div */}
  </div>
)}
```

#### 3.3.3 Draw Minimap Once

Use a `useEffect` to paint the RGBA buffer onto the canvas when it arrives.

```tsx
const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
const minimapImageDataRef = useRef<ImageData | null>(null);

useEffect(() => {
  const canvas = minimapCanvasRef.current;
  if (!canvas || !minimapRgba || !minimapWidth || !minimapHeight) return;
  canvas.width = minimapWidth;
  canvas.height = minimapHeight;
  const ctx = canvas.getContext('2d');
  const imageData = new ImageData(
    new Uint8ClampedArray(minimapRgba),
    minimapWidth,
    minimapHeight
  );
  ctx.putImageData(imageData, 0, 0);
  minimapImageDataRef.current = imageData;
}, [minimapRgba, minimapWidth, minimapHeight]);
```

#### 3.3.4 Draw Thumb on Scroll

We already have a `minimapThumbRef` (currently a div). We will repurpose it to store the thumb position and height, and redraw the canvas on every scroll.

```tsx
const drawThumb = useCallback(() => {
  const canvas = minimapCanvasRef.current;
  const ctx = canvas?.getContext('2d');
  if (!ctx || !minimapImageDataRef.current) return;
  // Restore original image
  ctx.putImageData(minimapImageDataRef.current, 0, 0);
  // Draw thumb overlay
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(0, thumbTop, minimapWidth, thumbHeight);
}, [thumbTop, thumbHeight, minimapWidth]);

useEffect(() => {
  drawThumb();
}, [thumbTop, thumbHeight, drawThumb]);
```

Where `thumbTop` and `thumbHeight` are derived from the scroll event (same logic as before, but now using `requestAnimationFrame` to avoid overdraw). Keep the existing scroll listener that updates `thumbTop` and `thumbHeight`.

#### 3.3.5 Click‑to‑Scroll

Implement `handleMinimapClick` to scroll the code block container based on click position relative to the canvas:

```tsx
const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
  const canvas = minimapCanvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = y / rect.height;
  const scrollable = scrollableRef.current;
  if (scrollable) {
    scrollable.scrollTop = ratio * scrollable.scrollHeight;
  }
};
```

#### 3.3.6 Draggable Thumb

Add mouse event listeners to the canvas to allow dragging:

```tsx
const [isDragging, setIsDragging] = useState(false);

const onMouseDown = (e: React.MouseEvent) => {
  setIsDragging(true);
  handleMinimapClick(e); // immediate jump
};

useEffect(() => {
  if (!isDragging) return;
  const onMouseMove = (e: MouseEvent) => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = Math.min(1, Math.max(0, y / rect.height));
    const scrollable = scrollableRef.current;
    if (scrollable) {
      scrollable.scrollTop = ratio * scrollable.scrollHeight;
    }
  };
  const onMouseUp = () => setIsDragging(false);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  return () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
}, [isDragging]);
```

Bind `onMouseDown` to the canvas container.

### 3.4 Adapt the Markdown Renderer to Pass Minimap Data to Frontend

The `NodeDocument` already includes `CodeBlock` nodes. The frontend `MarkdownView` component receives `document` and passes each `CodeBlock` node to `CodeBlock` as props. Therefore, after adding the minimap fields to the Rust type, they will automatically appear in the `node` prop.

**No changes needed** in `markdown-view.tsx` or `MessageBubble.tsx`.

### 3.5 Streaming Code Blocks

Streaming documents are handled by `IncrementalStream`. In `renderer.rs`, the `render_partial` method calls `render_blocks` with `emit_artifacts = false`. This means **draft code blocks will not have minimap data**. That is intentional – generating minimaps for every streaming delta would be expensive and cause flicker. Only the final persisted document will contain minimap data.

When a streaming message finishes, a new `AgentEvent::StreamUpdate` with a final document is sent. That document will have `emit_artifacts = true` and thus include minimap data. The frontend will receive it and update the code block.

**No extra code required.**

### 3.6 Performance Considerations

- **Memory**: A minimap for a 1000‑line code block (200 × 2000 pixels) uses ~1.6 MB of RGBA data. This is acceptable even for dozens of blocks.
- **CPU**: The minimap is generated once per code block on the Rust side, in a blocking thread. It will not affect UI responsiveness.
- **Canvas Redraws**: Only the thumb overlay is redrawn on scroll – a single `fillRect` per frame. This is cheap.
- **Streaming**: Draft nodes skip minimap generation, so streaming remains lightweight.

### 3.7 Testing & Verification

1. **Unit tests** for `minimap_from_lines` – verify that the output buffer dimensions match expectations and that colours are correctly set.
2. **Integration test** – render a known code block, fetch the minimap data, and compare against a reference image (optional).
3. **Manual testing**:
   - Open a conversation with a long code block.
   - Check that the minimap appears with correct colours.
   - Click anywhere on the minimap – the main editor should scroll to the corresponding line.
   - Drag the thumb – scrolling follows.
   - Resize the window – the canvas scales correctly (CSS `object-cover`).
   - Change syntax theme – minimap updates after a few seconds (the Rust theme is swapped and the code block is re‑highlighted; the minimap will be regenerated on the next re‑render).

### 3.8 Potential Pitfalls and Mitigations

| Pitfall | Mitigation |
|---------|------------|
| Minimap data for very large files (>5000 lines) | Use a reasonable `max_width_chars` (100) and `char_height_px=2`. 5000 lines → 10 000 pixels height → ~8 MB RGBA – still fine. If needed, we can later down‑sample by averaging lines, but not required for v1. |
| Thumb flicker during drag | Use `requestAnimationFrame` to batch scroll events. |
| Canvas not updating after theme change | The `MarkdownPipeline` is recreated when the theme changes, and all messages are re‑rendered. The frontend will receive new `NodeDocument` objects with fresh minimap data. |
| Streaming minimap missing | Users won’t notice – minimap appears only after the code block is fully streamed. That’s acceptable because minimap is not needed while typing. |
| Performance on very wide minimap | We cap width to 200px (2 px × 100 chars). The canvas is scaled with CSS, so the actual pixel buffer is only 200px wide, regardless of container width. |

## 4. Summary of Changes

| File | Changes |
|------|---------|
| `skilldeck-core/src/markdown/types.rs` | Add `minimap_rgba`, `minimap_width`, `minimap_height` to `CodeBlock` variant. |
| `skilldeck-core/src/markdown/renderer.rs` | Implement `minimap_from_lines` and call it in `highlight`. |
| `src/components/conversation/code-block.tsx` | Replace minimap div with canvas; add drawing logic and drag handlers. |

## 5. Rollout Plan

1. **Implement Rust changes** – add minimap generation, ensure it compiles and passes existing tests.
2. **Update frontend** – modify `CodeBlock` to use canvas minimap, keep existing scroll logic.
3. **Test locally** – verify minimap appears and works in all scenarios (existing conversations, new streaming, theme switch).
4. **Merge** – the feature is additive and does not break existing functionality. The old minimap is removed, but the component still works if minimap data is missing (fallback to no minimap).

## 6. Future Enhancements (Optional)

- Support minimap for very long lines by scaling the width dynamically.
- Add a toggle to show/hide minimap.
- Use WebGL for extremely large files (not needed for v1).

By following this plan, you will replace the broken JS minimap with a robust, syntect‑powered canvas minimap that is accurate, fast, and fully interactive.
