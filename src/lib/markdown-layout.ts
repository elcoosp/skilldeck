import {
  layoutItem,
  type PreparedItem,
  prepareItem,
  type Schema,
  schema,
  text
} from 'prelayout'
import type { MdNode, NodeDocument } from '@/lib/bindings'

// ============================================================
// Prose typography – matches your global CSS + @tailwindcss/typography
// ============================================================
const _PROSE_BODY_PX = 14

export interface ProseConfig {
  textFont: string
  textLineHeight: number
  headingFont: string
  headingLineHeight: number
  codeFont: string
  codeLineHeight: number
  codeBlockHeaderHeight: number
  codeBlockPaddingTop: number
  codeBlockPaddingBottom: number
  margins: {
    paragraph: { top: number; bottom: number }
    heading: { top: number; bottom: number }
    code_block: { top: number; bottom: number }
    list: { top: number; bottom: number }
    blockquote: { top: number; bottom: number }
    horizontal_rule: { top: number; bottom: number }
    html_block: { top: number; bottom: number }
  }
  listIndent: number
  listItemGap: number
  blockquoteIndent: number
}

export const DEFAULT_PROSE_CONFIG: ProseConfig = {
  textFont: '400 14px Poppins, Inter, Avenir, Helvetica, Arial, sans-serif',
  textLineHeight: 24,
  headingFont:
    '600 17.5px Poppins, Inter, Avenir, Helvetica, Arial, sans-serif',
  headingLineHeight: 28,
  codeFont:
    '400 13px ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  codeLineHeight: 20,
  codeBlockHeaderHeight: 36,
  codeBlockPaddingTop: 12,
  codeBlockPaddingBottom: 12,
  margins: {
    paragraph: { top: 17.5, bottom: 17.5 },
    heading: { top: 22.4, bottom: 8.4 },
    code_block: { top: 22.4, bottom: 22.4 },
    list: { top: 17.5, bottom: 17.5 },
    blockquote: { top: 22.4, bottom: 22.4 },
    horizontal_rule: { top: 39.2, bottom: 39.2 },
    html_block: { top: 0, bottom: 0 }
  },
  listIndent: 20,
  listItemGap: 3.5,
  blockquoteIndent: 20
}

// ============================================================
// Message chrome – measured from message-bubble.tsx
// ============================================================
export interface MessageChromeConfig {
  scrollPaddingLeft: number // pl-6 = 24
  wrapperPaddingX: number // px-4 = 32
  wrapperPaddingY: number // py-1.5 = 12

  assistantAvatarRowHeight: number
  assistantGapAfterAvatar: number
  assistantContentPaddingX: number
  assistantContentPaddingY: number
  assistantCopyButtonSlot: number

  userGap: number
  userAvatarSize: number
  userBubbleMaxWidthRatio: number
  userBubblePaddingX: number
  userBubblePaddingY: number
  userCopyButtonSlot: number
  userShowMoreButtonHeight: number
  userLongContentThreshold: number

  contextChipRowHeight: number
  contextChipGap: number

  toolMessageBaseHeight: number
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
  minAssistantHeight: 60
}

// ============================================================
// HTML helpers
// ============================================================
const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&#160;': ' '
}

function decodeEntities(s: string): string {
  return s.replace(
    /&(?:amp|lt|gt|quot|#39|apos|nbsp|#160);/g,
    (m) => ENTITY_MAP[m] ?? m
  )
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
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

// ============================================================
// Convert MdNode → layout block
// ============================================================
type TextBlock = {
  kind: 'text'
  blockType: 'paragraph' | 'heading' | 'blockquote'
  text: string
}
type CodeBlock = { kind: 'code'; rawCode: string }
type ListBlock = { kind: 'list'; items: string[] }
type HrBlock = { kind: 'hr' }
type HtmlBlock = { kind: 'html' }
type LayoutBlock = TextBlock | CodeBlock | ListBlock | HrBlock | HtmlBlock

function nodeToBlock(node: MdNode): LayoutBlock {
  switch (node.type) {
    case 'paragraph':
      return {
        kind: 'text',
        blockType: 'paragraph',
        text: stripHtml(node.html)
      }
    case 'heading':
      return { kind: 'text', blockType: 'heading', text: node.text }
    case 'code_block':
      return { kind: 'code', rawCode: node.raw_code }
    case 'list':
      return { kind: 'list', items: extractListItems(node.html) }
    case 'blockquote':
      return {
        kind: 'text',
        blockType: 'blockquote',
        text: stripHtml(node.html)
      }
    case 'horizontal_rule':
      return { kind: 'hr' }
    case 'html_block':
      return { kind: 'html' }
  }
}

// ============================================================
// Prelayout schemas
// ============================================================
interface Schemas {
  text: Schema
  heading: Schema
  code: Schema
  userText: Schema
}

function buildSchemas(c: ProseConfig): Schemas {
  const textSchema = schema({
    padding: 0,
    gap: 0,
    children: [text('text', { font: c.textFont, lineHeight: c.textLineHeight })]
  })
  const headingSchema = schema({
    padding: 0,
    gap: 0,
    children: [
      text('text', { font: c.headingFont, lineHeight: c.headingLineHeight })
    ]
  })
  const codeSchema = schema({
    padding: 0,
    gap: 0,
    children: [text('text', { font: c.codeFont, lineHeight: c.codeLineHeight })]
  })
  const userTextSchema = schema({
    padding: 0,
    gap: 0,
    children: [text('text', { font: c.textFont, lineHeight: c.textLineHeight })]
  })
  return {
    text: textSchema,
    heading: headingSchema,
    code: codeSchema,
    userText: userTextSchema
  }
}

// ============================================================
// Prepared blocks
// ============================================================
interface PreparedTextBlock {
  kind: 'text'
  blockType: 'paragraph' | 'heading' | 'blockquote'
  prepared: PreparedItem
}
interface PreparedCodeBlock {
  kind: 'code'
  prepared: PreparedItem
}
interface PreparedListBlock {
  kind: 'list'
  items: PreparedItem[]
}
interface PreparedHrBlock {
  kind: 'hr'
}
interface PreparedHtmlBlock {
  kind: 'html'
}
type PreparedBlock =
  | PreparedTextBlock
  | PreparedCodeBlock
  | PreparedListBlock
  | PreparedHrBlock
  | PreparedHtmlBlock

const NBSP = '\u00A0'

function prepareBlocks(
  nodes: MdNode[],
  schemas: Schemas,
  fallbackText?: string
): PreparedBlock[] {
  const blocks: LayoutBlock[] =
    nodes.length > 0
      ? nodes.map(nodeToBlock)
      : fallbackText
        ? [{ kind: 'text', blockType: 'paragraph', text: fallbackText }]
        : []

  return blocks.map((b) => {
    switch (b.kind) {
      case 'text': {
        const s = b.blockType === 'heading' ? schemas.heading : schemas.text
        return {
          kind: 'text',
          blockType: b.blockType,
          prepared: prepareItem({ text: b.text || NBSP }, s)
        }
      }
      case 'code':
        return {
          kind: 'code',
          prepared: prepareItem({ text: b.rawCode || NBSP }, schemas.code, {
            whiteSpace: 'pre-wrap'
          })
        }
      case 'list':
        return {
          kind: 'list',
          items: (b.items.length > 0 ? b.items : [NBSP]).map((t) =>
            prepareItem({ text: t }, schemas.text)
          )
        }
      case 'hr':
        return { kind: 'hr' }
      case 'html':
        return { kind: 'html' }
    }
  })
}

// ============================================================
// Margin collapsing + layout
// ============================================================
function getMargin(
  block: PreparedBlock,
  key: 'top' | 'bottom',
  c: ProseConfig
): number {
  switch (block.kind) {
    case 'text':
      return c.margins[block.blockType][key]
    case 'code':
      return c.margins.code_block[key]
    case 'list':
      return c.margins.list[key]
    case 'hr':
      return c.margins.horizontal_rule[key]
    case 'html':
      return c.margins.html_block[key]
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
        if (block.blockType === 'blockquote') w -= c.blockquoteIndent
        h = layoutItem(block.prepared, Math.max(60, w), s)
        break
      }
      case 'code': {
        const codeTextHeight = layoutItem(
          block.prepared,
          Math.max(60, textAreaWidth),
          schemas.code
        )
        h =
          c.codeBlockHeaderHeight +
          c.codeBlockPaddingTop +
          codeTextHeight +
          c.codeBlockPaddingBottom
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

    if (i > 0) {
      const prevBottom = getMargin(blocks[i - 1], 'bottom', c)
      const thisTop = getMargin(block, 'top', c)
      total += Math.max(prevBottom, thisTop)
    }
    total += h
  }
  return total
}

// ============================================================
// Height engine
// ============================================================
interface CachedMessage {
  stable: PreparedBlock[]
  draft: PreparedBlock[]
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
    content: string
  ): void {
    const cached = this.store.get(msgId)
    if (role === 'user') {
      if (!cached?.userPrepared) {
        this.store.set(msgId, {
          stable: [],
          draft: [],
          userPrepared: prepareItem(
            { text: content || NBSP },
            this.schemas.userText,
            { whiteSpace: 'pre-wrap' }
          )
        })
      }
      return
    }
    if (role === 'tool') {
      if (!cached) {
        this.store.set(msgId, { stable: [], draft: [], userPrepared: null })
      }
      return
    }
    // assistant messages (role 'assistant')
    const stableNodes = doc?.stable_nodes ?? []
    const draftNodes = doc?.draft_nodes ?? []
    this.store.set(msgId, {
      stable: prepareBlocks(stableNodes, this.schemas),
      draft: prepareBlocks(draftNodes, this.schemas),
      userPrepared: null
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

  private layoutUser(
    prepared: PreparedItem,
    containerWidth: number,
    contentLength: number
  ): number {
    const c = this.chrome
    const contentArea = containerWidth - c.scrollPaddingLeft - c.wrapperPaddingX
    const flexAvailable = contentArea - c.userAvatarSize - c.userGap
    const maxBubble = c.userBubbleMaxWidthRatio * contentArea
    const bubbleWidth = Math.min(flexAvailable, maxBubble)
    const textWidth = Math.max(60, bubbleWidth - c.userBubblePaddingX)
    const textHeight = layoutItem(prepared, textWidth, this.schemas.userText)
    const bubbleHeight = c.userBubblePaddingY + textHeight
    const showMoreHeight =
      contentLength > c.userLongContentThreshold
        ? c.userShowMoreButtonHeight
        : 0
    const total = bubbleHeight + showMoreHeight + c.userCopyButtonSlot
    return Math.max(total, c.minUserHeight)
  }

  private layoutAssistant(
    cached: CachedMessage,
    containerWidth: number
  ): number {
    const c = this.chrome
    const p = this.prose
    const textAreaWidth = Math.max(
      60,
      containerWidth -
        c.scrollPaddingLeft -
        c.wrapperPaddingX -
        c.assistantContentPaddingX
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

  evict(msgId: string): void {
    this.store.delete(msgId)
  }

  clear(): void {
    this.store.clear()
  }
}

export function estimateContextChipHeight(
  itemCount: number,
  containerWidth: number,
  chrome: MessageChromeConfig
): number {
  if (itemCount === 0) return 0
  const available =
    containerWidth - chrome.scrollPaddingLeft - chrome.wrapperPaddingX - 40
  const perRow = Math.max(1, Math.floor(available / 124))
  const rows = Math.ceil(itemCount / perRow)
  return rows * chrome.contextChipRowHeight + chrome.contextChipGap
}
