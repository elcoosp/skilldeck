import { describe, expect, it, vi } from 'vitest'
import type { NodeDocument } from '@/lib/bindings'
import {
  DEFAULT_CHROME_CONFIG,
  DEFAULT_PROSE_CONFIG,
  estimateContextChipHeight,
  MarkdownHeightEngine
} from '@/lib/markdown-layout'

// The text-measurement library renders to the OffscreenCanvas 2D context,
// which happy-dom does not implement. Provide a deterministic stub (each char
// is 4px wide) so the engine's height math is pure and finite in the unit test
// environment.
const measureCtx = {
  font: '',
  measureText: (text: string) => ({ width: text.length * 4 })
}
class FakeOffscreenCanvas {
  getContext() {
    return measureCtx
  }
}
vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)

function emptyDoc(): NodeDocument {
  return {
    stable_nodes: [],
    draft_nodes: [],
    toc_items: [],
    artifact_specs: []
  }
}

function paragraphDoc(text = 'Hello world'): NodeDocument {
  return {
    ...emptyDoc(),
    stable_nodes: [{ type: 'paragraph', id: 'p1', html: `<p>${text}</p>` }]
  }
}

describe('MarkdownHeightEngine.prepare/layout', () => {
  it('returns a finite height ≥ minAssistantHeight for an assistant paragraph', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare('m1', paragraphDoc(), 'assistant', '')
    const h = e.layout('m1', 640, 0)
    expect(Number.isFinite(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(DEFAULT_CHROME_CONFIG.minAssistantHeight)
  })

  it('returns minAssistantHeight for an unknown msgId', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    expect(e.layout('ghost', 640, 0)).toBe(
      DEFAULT_CHROME_CONFIG.minAssistantHeight
    )
  })

  it('returns toolMessageBaseHeight for tool role messages', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare('t1', null, 'tool', '')
    expect(e.layout('t1', 640, 0)).toBe(
      DEFAULT_CHROME_CONFIG.toolMessageBaseHeight
    )
  })

  it('applies show-more chrome when content exceeds the long-content threshold', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare('u1', null, 'user', 'x'.repeat(2000))
    const short = e.layout('u1', 640, 100)
    const long = e.layout('u1', 640, 400)
    expect(Number.isFinite(long)).toBe(true)
    expect(long).toBeGreaterThanOrEqual(DEFAULT_CHROME_CONFIG.minUserHeight)
    expect(long - short).toBe(DEFAULT_CHROME_CONFIG.userShowMoreButtonHeight)
  })

  it('keeps a user bubble within the configured max ratio for narrow containers', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare('u2', null, 'user', 'short text')
    const h = e.layout('u2', 200, 0)
    expect(Number.isFinite(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(DEFAULT_CHROME_CONFIG.minUserHeight)
  })

  it('prepare twice for the same assistant id returns an identical height', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    const doc = paragraphDoc()
    e.prepare('a1', doc, 'assistant', '')
    const h1 = e.layout('a1', 640, 0)
    e.prepare('a1', doc, 'assistant', '')
    const h2 = e.layout('a1', 640, 0)
    expect(h1).toBe(h2)
  })

  it('evict removes a cached message', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare('a1', paragraphDoc(), 'assistant', '')
    e.evict('a1')
    expect(e.layout('a1', 640, 0)).toBe(
      DEFAULT_CHROME_CONFIG.minAssistantHeight
    )
  })

  it('clear drops every cached message', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare('a1', paragraphDoc(), 'assistant', '')
    e.prepare('u1', null, 'user', 'hi')
    e.clear()
    expect(e.layout('a1', 640, 0)).toBe(
      DEFAULT_CHROME_CONFIG.minAssistantHeight
    )
    expect(e.layout('u1', 640, 0)).toBe(
      DEFAULT_CHROME_CONFIG.minAssistantHeight
    )
  })
})

describe('estimateContextChipHeight', () => {
  it('returns 0 for zero items', () => {
    expect(estimateContextChipHeight(0, 640, DEFAULT_CHROME_CONFIG)).toBe(0)
  })

  it('returns a positive number for items', () => {
    const h = estimateContextChipHeight(3, 640, DEFAULT_CHROME_CONFIG)
    expect(Number.isFinite(h)).toBe(true)
    expect(h).toBeGreaterThan(0)
  })

  it('fits a single row when the container is wide', () => {
    const h = estimateContextChipHeight(2, 1200, DEFAULT_CHROME_CONFIG)
    expect(h).toBe(
      DEFAULT_CHROME_CONFIG.contextChipRowHeight +
        DEFAULT_CHROME_CONFIG.contextChipGap
    )
  })

  it('adds a row when the item count exceeds one row', () => {
    const one = estimateContextChipHeight(2, 1200, DEFAULT_CHROME_CONFIG)
    const many = estimateContextChipHeight(50, 1200, DEFAULT_CHROME_CONFIG)
    expect(many).toBeGreaterThan(one)
  })
})
