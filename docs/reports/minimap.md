You're absolutely right – the Faiyels code is a treasure trove of ideas. It renders **every character as a colored rectangle** using GPU instancing, achieving millions of boxes at 60fps. We can borrow that exact philosophy for the minimap, but instead of real‑time rendering we **pre‑compute a pixel buffer** on the Rust side, one pixel (or small block) per character. Then React just blits that buffer to a canvas and handles clicks/drags – no per‑scroll calculations, perfect syntax colours, and full interactivity.

Below is a complete implementation plan inspired by Faiyels, integrated directly into your existing `markdown` renderer.

---

## 1. How Faiyels does it (and how we adapt)

In `layout.rs`, Faiyels:
- Walks each line, gets syntax‑highlighted regions (`style`, `s`).
- For **each non‑whitespace character**, pushes an `Instance` with a `translate` (position) and a `color` (packed u32 RGBA).
- The vertex shader draws a 1×1 quad at `a_Position + a_Translate` and passes the colour.

**For our minimap**:  
We replace the GPU instancing with a **CPU‑side pixel buffer**. Each character becomes a small block of pixels (e.g. 2×2 or 3×3) so the minimap is readable. We keep the exact same logic for iterating characters and colours.

---

## 2. Rust side – generate minimap RGBA buffer

Add three new fields to `MdNode::CodeBlock` in `types.rs`:

```rust
CodeBlock {
    // ... existing fields ...
    pub minimap_rgba: Vec<u8>,   // flat RGBA, width * height * 4
    pub minimap_width: u32,
    pub minimap_height: u32,
}
```

### 2.1 Helper: character → pixel block

In `renderer.rs`, add a function that mimics Faiyels’ character iteration but writes to a buffer:

```rust
fn minimap_from_lines(
    lines: &[&str],
    syntax: &SyntaxDefinition,
    theme: &Theme,
    char_width_px: u32,   // e.g. 2
    char_height_px: u32,  // e.g. 2
    max_width_chars: u32, // wrap at this many characters (like Faiyels' 100)
) -> (Vec<u8>, u32, u32) {
    if lines.is_empty() {
        return (vec![], 0, 0);
    }

    // Calculate final image dimensions
    let max_chars_per_line = max_width_chars;
    let num_lines = lines.len();
    let image_width = max_chars_per_line * char_width_px;
    let image_height = num_lines as u32 * char_height_px;

    let mut rgba = vec![0u8; (image_width * image_height * 4) as usize];
    let mut line_y = 0;

    for &line in lines {
        let mut parse_state = ParseState::new(syntax);
        let ops = parse_state.parse_line(line, &SYNTAX_SET).unwrap_or_default();
        let mut col = 0;
        let mut pos = 0;

        for (start, end, style_idx) in ops {
            // Fill any uncolored gap with default foreground
            if start > pos {
                let default_fg = theme.settings.foreground.unwrap_or(Color::WHITE);
                let len = start - pos;
                for _ in 0..len {
                    if col < max_chars_per_line {
                        fill_block(&mut rgba, line_y, col, char_width_px, char_height_px, image_width, default_fg);
                        col += 1;
                    }
                }
                pos = start;
            }

            let style = theme.styles[style_idx as usize];
            let fg = style.foreground;
            let token_len = end - start;
            for _ in 0..token_len {
                if col < max_chars_per_line {
                    fill_block(&mut rgba, line_y, col, char_width_px, char_height_px, image_width, fg);
                    col += 1;
                }
            }
            pos = end;
        }

        // Remaining characters after last token (should be none, but safe)
        if pos < line.len() {
            let default_fg = theme.settings.foreground.unwrap_or(Color::WHITE);
            for _ in pos..line.len() {
                if col < max_chars_per_line {
                    fill_block(&mut rgba, line_y, col, char_width_px, char_height_px, image_width, default_fg);
                    col += 1;
                }
            }
        }

        line_y += 1;
    }

    (rgba, image_width, image_height)
}

fn fill_block(
    rgba: &mut [u8],
    line_idx: u32,
    char_col: u32,
    char_w: u32,
    char_h: u32,
    full_width: u32,
    color: Color,
) {
    let start_x = char_col * char_w;
    let start_y = line_idx * char_h;
    for dy in 0..char_h {
        for dx in 0..char_w {
            let px_x = start_x + dx;
            let px_y = start_y + dy;
            if px_x < full_width && px_y < (rgba.len() as u32 / (full_width * 4)) {
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

**Why this works like Faiyels**:  
- We iterate tokens exactly as Faiyels does.  
- We respect a maximum line width (`max_width_chars`) and wrap implicitly – Faiyels uses 100 columns and resets `translate[0]`. Here we simply cap `col` and stop drawing beyond that limit.  
- Each character occupies a fixed pixel block (2×2, 3×3, etc.), giving a crisp minimap.

### 2.2 Hook into your existing `highlight` method

Inside `MarkdownPipeline::highlight`, after you have `lines` and the syntax, generate the minimap:

```rust
let (minimap_rgba, minimap_width, minimap_height) = minimap_from_lines(
    &lines,
    syntax,
    theme,
    2,    // char_width_px – experiment: 2 gives good detail without being huge
    2,    // char_height_px
    100,  // max_width_chars – same as Faiyels' wrap limit
);
```

Then store these three values in the `CodeBlock` node.

---

## 3. React side – interactive canvas minimap

In `code-block.tsx`, replace the broken minimap `div` with a `<canvas>` element. You’ll receive `minimapRgba`, `minimapWidth`, `minimapHeight` as props.

### 3.1 Draw the minimap once

```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);
const [thumbY, setThumbY] = useState(0);
const [thumbHeight, setThumbHeight] = useState(20);

useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !minimapRgba) return;
    canvas.width = minimapWidth;
    canvas.height = minimapHeight;
    const ctx = canvas.getContext('2d');
    const imageData = new ImageData(
        new Uint8ClampedArray(minimapRgba),
        minimapWidth,
        minimapHeight
    );
    ctx.putImageData(imageData, 0, 0);
}, [minimapRgba, minimapWidth, minimapHeight]);
```

### 3.2 Draw the thumb on every scroll

```tsx
const drawThumb = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !minimapRgba) return;
    // Redraw the original image (or use an offscreen canvas cache)
    ctx.putImageData(minimapImageData, 0, 0);
    // Draw semi-transparent thumb
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(0, thumbY, minimapWidth, thumbHeight);
}, [minimapRgba, minimapWidth, thumbY, thumbHeight]);

useEffect(() => {
    drawThumb();
}, [thumbY, thumbHeight, drawThumb]);
```

Update `thumbY` and `thumbHeight` from your code block’s scroll event (you already have the logic for `minimapThumbRef` – just reuse those calculations).

### 3.3 Click‑to‑scroll

```tsx
const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;
    const targetScrollTop = ratio * codeScrollableRef.current.scrollHeight;
    codeScrollableRef.current.scrollTop = targetScrollTop;
};
```

### 3.4 Drag‑to‑scroll (thumb dragging)

Add `onMouseDown` to the canvas, listen to `mousemove` on the window, and update scroll position accordingly.

```tsx
const [isDragging, setIsDragging] = useState(false);

const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    // also set initial scroll based on click
    handleMinimapClick(e);
};

useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const y = e.clientY - rect.top;
        const ratio = Math.min(1, Math.max(0, y / rect.height));
        const targetScrollTop = ratio * codeScrollableRef.current.scrollHeight;
        codeScrollableRef.current.scrollTop = targetScrollTop;
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

---

## 4. Performance & memory

- For a 1000‑line file, `char_width_px = 2`, `char_height_px = 2`, `max_width_chars = 100` → image size = 200×2000 = 400,000 pixels × 4 bytes = **1.6 MB**. That’s nothing for modern machines.
- The generation happens **once per code block** (or when theme changes) – no runtime cost.
- React only re‑renders the canvas when the minimap data changes; scrolling only redraws the thumb (a single `fillRect`).

---

## 5. Going further – Faiyels‑style zoom

Faiyels allows zooming in until you see actual letters. For a minimap you don’t need that, but you could store **multiple resolution levels** (like mipmaps) if you ever implement a zoomable overview.

---

## 6. Summary of changes to your codebase

| File                     | Changes                                                                 |
|--------------------------|-------------------------------------------------------------------------|
| `markdown/types.rs`      | Add `minimap_rgba`, `minimap_width`, `minimap_height` to `CodeBlock`.   |
| `markdown/renderer.rs`   | Add `minimap_from_lines` and call it inside `highlight`.                |
| `code-block.tsx`         | Replace minimap `div` with `<canvas>` + drawing + drag logic.           |

This approach gives you:
- **Perfect colour accuracy** (same `syntect` engine as your main code view).
- **Zero runtime syntax analysis** – all done ahead of time.
- **Full interactivity** (click + drag) with minimal React overhead.
- **Inspired directly by Faiyels** – the per‑character colour iteration is identical to the original.

Your minimap will now be fast, accurate, and a joy to use – exactly what Faiyels set out to achieve.
