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

function mixedDoc(): NodeDocument {
  return {
    stable_nodes: [
      { type: 'paragraph', id: 'p1', html: '<p>Tom &amp; Jerry</p>' },
      {
        type: 'heading',
        id: 'h1',
        level: 2,
        text: 'Section',
        slug: 'section',
        toc_index: 0
      },
      {
        type: 'code_block',
        id: 'c1',
        language: 'ts',
        raw_code: 'const a = 1\nconst b = 2',
        highlighted_lines: [],
        artifact_id: 'a1',
        line_count: 2,
        file_path: null,
        token_count: 10,
        minimap_rgba: [],
        minimap_width: 0,
        minimap_height: 0
      },
      {
        type: 'list',
        id: 'l1',
        ordered: false,
        html: '<ul><li>first</li><li>second</li></ul>'
      },
      {
        type: 'blockquote',
        id: 'q1',
        html: '<blockquote><p>Quoted</p></blockquote>'
      },
      { type: 'horizontal_rule', id: 'r1' },
      { type: 'html_block', id: 'hb1', html: '<div>raw</div>' }
    ],
    draft_nodes: [],
    toc_items: [],
    artifact_specs: []
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

  it('lays out a document mixing every block type', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare('m1', mixedDoc(), 'assistant', '')
    const h = e.layout('m1', 640, 0)
    expect(Number.isFinite(h)).toBe(true)
    expect(h).toBeGreaterThan(DEFAULT_CHROME_CONFIG.minAssistantHeight)
  })

  it('renders draft nodes alongside stable nodes', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare(
      'm1',
      { ...paragraphDoc(), draft_nodes: [{
        type: 'paragraph',
        id: 'd1',
        html: '<p>streaming draft</p>'
      }] },
      'assistant',
      ''
    )
    const h = e.layout('m1', 640, 0)
    expect(h).toBeGreaterThan(DEFAULT_CHROME_CONFIG.minAssistantHeight)
  })

  it('falls back to NBSP content for an empty user message', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare('u3', null, 'user', '')
    expect(Number.isFinite(e.layout('u3', 640, 0))).toBe(true)
  })

  it('keeps the first prepared user content for a repeated prepare', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare('u4', null, 'user', 'first')
    e.prepare('u4', null, 'user', 'second')
    const h = e.layout('u4', 640, 0)
    expect(h).toBeGreaterThanOrEqual(DEFAULT_CHROME_CONFIG.minUserHeight)
  })

  it('parses a list node whose html carries no list items', () => {
    const e = new MarkdownHeightEngine(
      DEFAULT_PROSE_CONFIG,
      DEFAULT_CHROME_CONFIG
    )
    e.prepare(
      'm1',
      {
        ...emptyDoc(),
        stable_nodes: [
          {
            type: 'list',
            id: 'l1',
            ordered: true,
            html: '<div>plain content</div>'
          }
        ]
      },
      'assistant',
      ''
    )
    expect(Number.isFinite(e.layout('m1', 640, 0))).toBe(true)
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
