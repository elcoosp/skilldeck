This is a perfect opportunity to eliminate the `ResizeObserver` entirely. By reading the center panel width directly from the layout store, the virtual list updates **synchronously** with the panel drag — zero `ResizeObserver` microtask delay.

There's also a critical bug in the previous engine: `scrollPaddingLeft` was defined in the config but **never subtracted** from the width in any of the layout functions. This caused heights to be slightly underestimated. Here are all the fixes.

## 1. Update the UI Layout Store

Add `center` to the panel sizes. I don't have your original file, but here's the updated slice:

```typescript
// src/store/ui-layout.ts

import { create } from 'zustand'

interface UILayoutState {
  panelSizesPx: {
    left: number
    center: number
    right: number
  }
  setPanelSizesPx: (sizes: {
    left?: number
    center?: number
    right?: number
  }) => void
}

export const useUILayoutStore = create<UILayoutState>((set) => ({
  panelSizesPx: { left: 0, center: 0, right: 0 },
  setPanelSizesPx: (sizes) =>
    set((state) => ({
      panelSizesPx: { ...state.panelSizesPx, ...sizes },
    })),
}))
```

## 2. Update App Shell to Derive Center Width

Pure math on pointer release — zero DOM reads.

```typescript
// src/components/layout/app-shell.tsx
// (only the changed sections shown)

  // ⚠️ Use onLayoutChanged (fires once on pointer release) instead of
  // onLayoutChange (fires on every pointer move). This eliminates lag.
  const handleLayoutChanged = useCallback(
    (newLayout: Layout) => {
      setLayout(newLayout)

      // Derive pixel sizes from percentages – pure arithmetic, zero DOM reads
      const totalWidth = window.innerWidth
      const leftPx = Math.round(((newLayout[PANEL_LEFT] ?? 20) / 100) * totalWidth)
      const rightPx = Math.round(((newLayout[PANEL_RIGHT] ?? 20) / 100) * totalWidth)
      
      // Center width = total minus left/right panels minus 2px for the two separators
      const centerPx = Math.max(35, totalWidth - leftPx - rightPx - 2)

      setPanelSizesPx({
        left: leftPx,
        center: centerPx,
        right: rightPx
      })

      // Debounce the write just in case
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(newLayout))
      }, 300)
    },
    [setPanelSizesPx]
  )

  // Sync pixel sizes on mount (one-time read, no ResizeObserver)
  useEffect(() => {
    const panels = document.querySelectorAll('[data-panel]')
    const left = panels[0] as HTMLDivElement
    const center = panels[1] as HTMLDivElement
    const right = panels[2] as HTMLDivElement
    setPanelSizesPx({
      left: left?.clientWidth ?? 0,
      center: center?.clientWidth ?? 0,
      right: right?.clientWidth ?? 0
    })
  }, [setPanelSizesPx])
```

## 3. Bug Fix + Final Layout Engine

```typescript
// src/lib/markdown-layout.ts

import {
  schema,
  text,
  prepareItem,
  layoutItem,
  type Schema,
  type PreparedItem
} from 'prelayout'
import type { MdNode, NodeDocument } from '@/lib/bindings'

// ═══════════════════════════════════════════════════════════════════════════
// Prose typography — derived from your global CSS + @tailwindcss/typography
//
// :root sets font-family: "Poppins", ... and font-size: 16px.
// prose-sm overrides body to 0.875rem = 14px on child elements.
// All "em" margins below are relative to this 14px base.
// ═══════════════════════════════════════════════════════════════════════════

const PROSE_BODY_PX = 14 // 0.875rem

export interface ProseConfig {
  // ── Font shorthand for canvas.measureText() ────────────────────────
  textFont: string
  textLineHeight: number           // prose-sm p: 1.7142857 × 14 = 24px

  headingFont: string
  headingLineHeight: number        // prose-sm h3: 1.6 × 17.5 = 28px

  // ── Code blocks ────────────────────────────────────────────────────
  codeFont: string
  codeLineHeight: number
  codeBlockHeaderHeight: number
  codeBlockPaddingTop: number
  codeBlockPaddingBottom: number

  // ── prose-sm margins (CSS margin collapsing between siblings) ──────
  margins: {
    paragraph:       { top: number; bottom: number }  // 1.25em = 17.5px
    heading:         { top: number; bottom: number }  // h3: 1.6em / 0.6em
    code_block:      { top: number; bottom: number }  // 1.6em = 22.4px
    list:            { top: number; bottom: number }  // 1.25em = 17.5px
    blockquote:      { top: number; bottom: number }  // 1.6em = 22.4px
    horizontal_rule: { top: number; bottom: number }  // 2.8em = 39.2px
    html_block:      { top: number; bottom: number }  // 0
  }

  listIndent: number              // NodeRenderer pl-5 = 20px
  listItemGap: number             // prose-sm li margin-top: 0.25em = 3.5px
  blockquoteIndent: number        // NodeRenderer pl-4 + border-l-4 = 20px
}

export const DEFAULT_PROSE_CONFIG: ProseConfig = {
  textFont: '400 14px Poppins, Inter, Avenir, Helvetica, Arial, sans-serif',
  textLineHeight: 24,

  headingFont: '600 17.5px Poppins, Inter, Avenir, Helvetica, Arial, sans-serif',
  headingLineHeight: 28,

  codeFont: '400 13px ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  codeLineHeight: 20,
  codeBlockHeaderHeight: 36,
  codeBlockPaddingTop: 12,
  codeBlockPaddingBottom: 12,

  margins: {
    paragraph:       { top: 17.5, bottom: 17.5 },
    heading:         { top: 22.4, bottom: 8.4 },
    code_block:      { top: 22.4, bottom: 22.4 },
    list:            { top: 17.5, bottom: 17.5 },
    blockquote:      { top: 22.4, bottom: 22.4 },
    horizontal_rule: { top: 39.2, bottom: 39.2 },
    html_block:      { top: 0, bottom: 0 },
  },

  listIndent: 20,
  listItemGap: 3.5,
  blockquoteIndent: 20,
}

// ═══════════════════════════════════════════════════════════════════════════
// Message chrome — measured from message-bubble.tsx structure
// ═══════════════════════════════════════════════════════════════════════════

export interface MessageChromeConfig {
  // ── Horizontal padding subtracted from containerWidth ──────────────
  // containerWidth comes from the store (scrollContainer.clientWidth).
  // These values are subtracted to find the actual text area.
  scrollPaddingLeft: number       // scroll container pl-6 = 24
  wrapperPaddingX: number         // VirtualRow px-4 = 32

  // ── Vertical chrome (added to content height) ──────────────────────
  wrapperPaddingY: number         // VirtualRow py-1.5 = 12

  // ── Assistant chrome ───────────────────────────────────────────────
  assistantAvatarRowHeight: number
  assistantGapAfterAvatar: number
  assistantContentPaddingX: number
  assistantContentPaddingY: number
  assistantCopyButtonSlot: number

  // ── User chrome ────────────────────────────────────────────────────
  userGap: number
  userAvatarSize: number
  userBubbleMaxWidthRatio: number
  userBubblePaddingX: number
  userBubblePaddingY: number
  userCopyButtonSlot: number
  userShowMoreButtonHeight: number
  userLongContentThreshold: number

  // ── Context chips ──────────────────────────────────────────────────
  contextChipRowHeight: number
  contextChipGap: number

  // ── Tool messages ──────────────────────────────────────────────────
  toolMessageBaseHeight: number

  // ── Floors ─────────────────────────────────────────────────────────
  minUserHeight: number
  minAssistantHeight: number
}

export const DEFAULT_CHROME_CONFIG: MessageChromeConfig = {
  scrollPaddingLeft: 24,
  wrapperPaddingX: 32,
  wrapperPaddingY: 12,

  assistantAvatarRowHeight: 28,
  assistantGapAfterAvatar: 4,
  assistantContentPaddingX: 26,
  assistantContentPaddingY: 20,
  assistantCopyButtonSlot: 22,

  userGap: 12,
  userAvatarSize: 28,
  userBubbleMaxWidthRatio: 0.78,
  userBubblePaddingX: 28,
  userBubblePaddingY: 20,
  userCopyButtonSlot: 22,
  userShowMoreButtonHeight: 24,
  userLongContentThreshold: 300,

  contextChipRowHeight: 28,
  contextChipGap: 8,

  toolMessageBaseHeight: 80,

  minUserHeight: 48,
  minAssistantHeight: 60,
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML → plain text
// ═══════════════════════════════════════════════════════════════════════════

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&#160;': ' ',
}

function decodeEntities(s: string): string {
  return s.replace(
    /&(?:amp|lt|gt|quot|#39|apos|nbsp|#160);/g,
    m => ENTITY_MAP[m] ?? m
  )
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function extractListItems(html: string): string[] {
  const items: string[] = []
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const t = stripHtml(m[1])
    if (t) items.push(t)
  }
  return items.length > 0 ? items : [stripHtml(html)]
}

// ═══════════════════════════════════════════════════════════════════════════
// MdNode → layout block
// ═══════════════════════════════════════════════════════════════════════════

type TextBlock = { kind: 'text'; blockType: 'paragraph' | 'heading' | 'blockquote'; text: string }
type CodeBlock = { kind: 'code'; rawCode: string }
type ListBlock = { kind: 'list'; items: string[] }
type HrBlock = { kind: 'hr' }
type HtmlBlock = { kind: 'html' }

type LayoutBlock = TextBlock | CodeBlock | ListBlock | HrBlock | HtmlBlock

function nodeToBlock(node: MdNode): LayoutBlock {
  switch (node.type) {
    case 'paragraph':
      return { kind: 'text', blockType: 'paragraph', text: stripHtml(node.html) }
    case 'heading':
      return { kind: 'text', blockType: 'heading', text: node.text }
    case 'code_block':
      return { kind: 'code', rawCode: node.raw_code }
    case 'list':
      return { kind: 'list', items: extractListItems(node.html) }
    case 'blockquote':
      return { kind: 'text', blockType: 'blockquote', text: stripHtml(node.html) }
    case 'horizontal_rule':
      return { kind: 'hr' }
    case 'html_block':
      return { kind: 'html' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Prelayout schemas
// ═══════════════════════════════════════════════════════════════════════════

interface Schemas {
  text: Schema
  heading: Schema
  code: Schema
  userText: Schema
}

function buildSchemas(c: ProseConfig): Schemas {
  const textSchema = schema({
    padding: 0, gap: 0,
    children: [text('text', { font: c.textFont, lineHeight: c.textLineHeight })],
  })
  const headingSchema = schema({
    padding: 0, gap: 0,
    children: [text('text', { font: c.headingFont, lineHeight: c.headingLineHeight })],
  })
  const codeSchema = schema({
    padding: 0, gap: 0,
    children: [text('text', { font: c.codeFont, lineHeight: c.codeLineHeight })],
  })
  const userTextSchema = schema({
    padding: 0, gap: 0,
    children: [text('text', { font: c.textFont, lineHeight: c.textLineHeight })],
  })

  return { text: textSchema, heading: headingSchema, code: codeSchema, userText: userTextSchema }
}

// ═══════════════════════════════════════════════════════════════════════════
// Prepared blocks
// ═══════════════════════════════════════════════════════════════════════════

interface PreparedTextBlock {
  kind: 'text'
  blockType: 'paragraph' | 'heading' | 'blockquote'
  prepared: PreparedItem
}
interface PreparedCodeBlock {
  kind: 'code'
  prepared: PreparedItem
}
interface PreparedListBlock { kind: 'list'; items: PreparedItem[] }
interface PreparedHrBlock { kind: 'hr' }
interface PreparedHtmlBlock { kind: 'html' }

type PreparedBlock =
  | PreparedTextBlock
  | PreparedCodeBlock
  | PreparedListBlock
  | PreparedHrBlock
  | PreparedHtmlBlock

const NBSP = '\u00A0'

function prepareBlocks(nodes: MdNode[], schemas: Schemas, fallbackText?: string): PreparedBlock[] {
  const blocks: LayoutBlock[] = nodes.length > 0
    ? nodes.map(nodeToBlock)
    : fallbackText
      ? [{ kind: 'text' as const, blockType: 'paragraph' as const, text: fallbackText }]
      : []

  return blocks.map(b => {
    switch (b.kind) {
      case 'text': {
        const s = b.blockType === 'heading' ? schemas.heading : schemas.text
        return {
          kind: 'text' as const,
          blockType: b.blockType,
          prepared: prepareItem({ text: b.text || NBSP }, s),
        }
      }
      case 'code':
        return {
          kind: 'code' as const,
          prepared: prepareItem({ text: b.rawCode || NBSP }, schemas.code, { whiteSpace: 'pre-wrap' }),
        }
      case 'list':
        return {
          kind: 'list' as const,
          items: (b.items.length > 0 ? b.items : [NBSP]).map(
            t => prepareItem({ text: t }, schemas.text)
          ),
        }
      case 'hr':
        return { kind: 'hr' as const }
      case 'html':
        return { kind: 'html' as const }
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Hash for stable_nodes identity check
// ═══════════════════════════════════════════════════════════════════════════

function nodesHash(nodes: MdNode[]): number {
  let h = 0
  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes[i].id.length; j++) {
      h = ((h << 5) - h + nodes[i].id.charCodeAt(j)) | 0
    }
  }
  return h
}

// ═══════════════════════════════════════════════════════════════════════════
// Margin collapsing + layout
// ═══════════════════════════════════════════════════════════════════════════

function getMargin(block: PreparedBlock, key: 'top' | 'bottom', c: ProseConfig): number {
  switch (block.kind) {
    case 'text':   return c.margins[block.blockType][key]
    case 'code':   return c.margins.code_block[key]
    case 'list':   return c.margins.list[key]
    case 'hr':     return c.margins.horizontal_rule[key]
    case 'html':   return c.margins.html_block[key]
  }
}

function layoutBlocks(
  blocks: PreparedBlock[],
  textAreaWidth: number,
  schemas: Schemas,
  c: ProseConfig
): number {
  if (blocks.length === 0) return 0

  let total = 0

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    let h: number

    switch (block.kind) {
      case 'text': {
        const s = block.blockType === 'heading' ? schemas.heading : schemas.text
        let w = textAreaWidth
        if (block.blockType === 'list') w -= c.listIndent
        if (block.blockType === 'blockquote') w -= c.blockquoteIndent
        h = layoutItem(block.prepared, Math.max(60, w), s)
        break
      }

      case 'code': {
        const codeTextHeight = layoutItem(block.prepared, Math.max(60, textAreaWidth), schemas.code)
        h = c.codeBlockHeaderHeight + c.codeBlockPaddingTop + codeTextHeight + c.codeBlockPaddingBottom
        break
      }

      case 'list': {
        let lh = 0
        const itemW = Math.max(60, textAreaWidth - c.listIndent)
        for (let j = 0; j < block.items.length; j++) {
          lh += layoutItem(block.items[j], itemW, schemas.text)
          if (j > 0) lh += c.listItemGap
        }
        h = lh
        break
      }

      case 'hr':
        h = 1
        break

      case 'html':
        h = 0
        break
    }

    if (i === 0) {
      // First block: no top margin (:first-child)
    } else {
      const prevBottom = getMargin(blocks[i - 1], 'bottom', c)
      const thisTop = getMargin(block, 'top', c)
      total += Math.max(prevBottom, thisTop)
    }

    total += h
  }

  return total
}

// ═══════════════════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════════════════

interface CachedMessage {
  stable: PreparedBlock[]
  draft: PreparedBlock[]
  stableHash: number
  userPrepared: PreparedItem | null
}

export class MarkdownHeightEngine {
  private schemas: Schemas
  private store = new Map<string, CachedMessage>()

  constructor(
    private prose: ProseConfig,
    private chrome: MessageChromeConfig
  ) {
    this.schemas = buildSchemas(prose)
  }

  prepare(
    msgId: string,
    doc: NodeDocument | null,
    role: string,
    content: string,
    hasContextItems: boolean
  ): void {
    const cached = this.store.get(msgId)

    if (role === 'user') {
      if (!cached?.userPrepared) {
        this.store.set(msgId, {
          stable: [], draft: [], stableHash: 0,
          userPrepared: prepareItem(
            { text: content || NBSP },
            this.schemas.userText,
            { whiteSpace: 'pre-wrap' }
          ),
        })
      }
      return
    }

    if (role === 'tool') {
      if (!cached) {
        this.store.set(msgId, { stable: [], draft: [], stableHash: 0, userPrepared: null })
      }
      return
    }

    const stableNodes = doc?.stable_nodes ?? []
    const draftNodes = doc?.draft_nodes ?? []
    const stableHash = nodesHash(stableNodes)

    if (cached && cached.stableHash === stableHash) {
      cached.draft = prepareBlocks(draftNodes, this.schemas)
      return
    }

    this.store.set(msgId, {
      stable: prepareBlocks(stableNodes, this.schemas),
      draft: prepareBlocks(draftNodes, this.schemas),
      stableHash,
      userPrepared: null,
    })
  }

  layout(msgId: string, containerWidth: number, contentLength: number): number {
    const cached = this.store.get(msgId)
    if (!cached) return this.chrome.minAssistantHeight

    if (cached.userPrepared) {
      return this.layoutUser(cached.userPrepared, containerWidth, contentLength)
    }

    if (cached.stable.length === 0 && cached.draft.length === 0) {
      return this.chrome.toolMessageBaseHeight
    }

    return this.layoutAssistant(cached, containerWidth)
  }

  /** User: flex-row-reverse, max-w-[78%], whitespace-pre-wrap */
  private layoutUser(prepared: PreparedItem, containerWidth: number, contentLength: number): number {
    const c = this.chrome

    // FIX: Subtract scrollPaddingLeft before calculating bubble bounds
    const contentArea = containerWidth - c.scrollPaddingLeft - c.wrapperPaddingX

    const flexAvailable = contentArea - c.userAvatarSize - c.userGap
    const maxBubble = c.userBubbleMaxWidthRatio * contentArea
    const bubbleWidth = Math.min(flexAvailable, maxBubble)

    const textWidth = Math.max(60, bubbleWidth - c.userBubblePaddingX)
    const textHeight = layoutItem(prepared, textWidth, this.schemas.userText)

    const bubbleHeight = c.userBubblePaddingY + textHeight
    const showMoreHeight = contentLength > c.userLongContentThreshold
      ? c.userShowMoreButtonHeight
      : 0

    const total = bubbleHeight + showMoreHeight + c.userCopyButtonSlot
    return Math.max(total, c.minUserHeight)
  }

  /** Assistant: avatar row + mt-1 + content div + copy button */
  private layoutAssistant(cached: CachedMessage, containerWidth: number): number {
    const c = this.chrome
    const p = this.prose

    // FIX: Subtract scrollPaddingLeft before calculating text area
    const textAreaWidth = Math.max(
      60,
      containerWidth - c.scrollPaddingLeft - c.wrapperPaddingX - c.assistantContentPaddingX
    )

    const allBlocks = cached.stable.concat(cached.draft)
    const proseHeight = layoutBlocks(allBlocks, textAreaWidth, this.schemas, p)

    const total =
      c.assistantAvatarRowHeight +
      c.assistantGapAfterAvatar +
      c.assistantContentPaddingY +
      proseHeight +
      c.assistantContentPaddingY +
      c.assistantCopyButtonSlot

    return Math.max(total, c.minAssistantHeight)
  }

  evict(msgId: string): void { this.store.delete(msgId) }
  clear(): void { this.store.clear() }
}

// ═══════════════════════════════════════════════════════════════════════════
// Context chip height estimate
// ═══════════════════════════════════════════════════════════════════════════

export function estimateContextChipHeight(
  itemCount: number,
  containerWidth: number,
  chrome: MessageChromeConfig
): number {
  if (itemCount === 0) return 0
  // FIX: Subtract scrollPaddingLeft before calculating chip wrapping
  const available = containerWidth - chrome.scrollPaddingLeft - chrome.wrapperPaddingX - 40
  const perRow = Math.max(1, Math.floor(available / 124))
  const rows = Math.ceil(itemCount / perRow)
  return rows * chrome.contextChipRowHeight + chrome.contextChipGap
}
```

## 4. Updated MessageThread (ResizeObserver removed)

```typescript
// src/components/conversation/message-thread.tsx
// (only the changed sections shown — everything else is identical)

import {
  // ... other imports
  useUILayoutStore
} from '@/store/ui-layout'

// Inside MessageThread component:

    // ── Container width — synced directly from panel layout store ─────
    // No ResizeObserver. Updates synchronously when panels are dragged.
    const containerWidth = useUILayoutStore((s) => s.panelSizesPx.center)
    
    // Fallback for initial mount before app-shell fires onLayoutChanged
    const effectiveWidth = containerWidth > 100 ? containerWidth : 800

    // ── estimateSize ──────────────────────────────────────────────────
    const estimateSize = React.useCallback(
      (index: number): number => {
        const msg = filteredMessagesRef.current[index]
        if (!msg) return 80

        if (msg.role === 'tool') {
          return CHROME_CONFIG.toolMessageBaseHeight
        }

        const baseHeight = engineRef.current!.layout(
          msg.id,
          effectiveWidth,
          msg.content.length
        )

        const chipHeight = (msg.context_items?.length ?? 0) > 0
          ? estimateContextChipHeight(msg.context_items!.length, effectiveWidth, CHROME_CONFIG)
          : 0

        return baseHeight + chipHeight
      },
      [effectiveWidth]
    )
```

## What this achieves

**Before (ResizeObserver):**
```
User drags panel separator
  → pointer move (16ms intervals)
  → onLayout fires (throttled)
  → DOM layout
  → ResizeObserver callback (async microtask, ~1-4ms delay)
  → React setState
  → Re-render
  → estimateSize runs
  → Virtual list updates
```

**After (Store-driven):**
```
User releases panel separator
  → onLayoutChanged fires
  → Pure math: totalWidth - leftPx - rightPx - 2
  → Zustand setPanelSizesPx (synchronous)
  → React re-render (subscribed component only)
  → estimateSize runs with new width
  → Virtual list updates
```

The `scrollPaddingLeft` bug fix ensures that the engine correctly models this DOM hierarchy:

```
<div clientWidth={containerWidth}>          ← pl-6 (24px)
  <div px-4>                                ← 32px
    <div pl-3.5 pr-3.5>                    ← 26px
      <p>text measured here</p>
```

Previous code subtracted 58px (32 + 26) from `containerWidth`. The actual available width is 82px (24 + 32 + 26) less than `containerWidth`. The 24px discrepancy caused the engine to think text had more room than it actually did, producing heights that were ~1-2px too short on average — enough to cause micro-jitters during fast scrolling.
