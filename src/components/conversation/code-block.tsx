// src/components/conversation/code-block.tsx

import { Check, ChevronRight, Copy, Loader2 } from 'lucide-react'
import type React from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '@/components/ui/toast'
import { useArtifactContent } from '@/hooks/use-artifact-content'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  language: string
  artifactId: string
  highlightedHtml: string
  isStreaming?: boolean
  scrollContainerRef?: React.RefObject<HTMLElement>
}

export const CodeBlock: React.FC<CodeBlockProps> = memo(
  ({
    language,
    artifactId,
    highlightedHtml,
    isStreaming = false,
    scrollContainerRef
  }) => {
    const [collapsed, setCollapsed] = useState(false)
    const [copied, setCopied] = useState(false)
    const { data: rawCode, isLoading } = useArtifactContent(artifactId)

    const containerRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)
    const floatingRef = useRef<HTMLDivElement>(null)
    const scrollableRef = useRef<HTMLDivElement>(null)
    const preRef = useRef<HTMLPreElement>(null)

    const isUserScrolledUp = useRef(false)
    const isProgrammaticScroll = useRef(false)

    // ─── Detect user scroll within the code block ────────────────────────────
    useEffect(() => {
      const scrollable = scrollableRef.current
      if (!scrollable) return
      const handleScroll = () => {
        if (isProgrammaticScroll.current) return
        const { scrollTop, scrollHeight, clientHeight } = scrollable
        isUserScrolledUp.current =
          Math.abs(scrollHeight - clientHeight - scrollTop) >= 10
      }
      scrollable.addEventListener('scroll', handleScroll, { passive: true })
      return () => scrollable.removeEventListener('scroll', handleScroll)
    }, [])

    // ─── Auto-scroll via MutationObserver during streaming ───────────────────
    useEffect(() => {
      if (!isStreaming || collapsed) return

      const scrollable = scrollableRef.current
      const pre = preRef.current
      if (!scrollable || !pre) return

      const scrollToBottom = () => {
        if (isUserScrolledUp.current) return
        isProgrammaticScroll.current = true
        scrollable.scrollTop = scrollable.scrollHeight
        requestAnimationFrame(() => {
          isProgrammaticScroll.current = false
        })
      }

      const observer = new MutationObserver(scrollToBottom)
      observer.observe(pre, {
        childList: true,
        subtree: true,
        characterData: true
      })
      scrollToBottom()

      return () => observer.disconnect()
    }, [isStreaming, collapsed])

    // ─── Floating header: portal + getBoundingClientRect ─────────────────────
    useEffect(() => {
      const root = scrollContainerRef?.current
      const container = containerRef.current
      const header = headerRef.current
      const floating = floatingRef.current
      const scrollable = scrollableRef.current

      if (!root || !container || !header || !floating || !scrollable) return

      const hide = () => {
        floating.style.opacity = '0'
        floating.style.pointerEvents = 'none'
        header.style.visibility = 'visible'
      }

      const sync = () => {
        if (collapsed) {
          hide()
          return
        }

        const rootRect = root.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()

        if (rootRect.width === 0 || rootRect.height === 0) {
          hide()
          return
        }

        const topGone = containerRect.top < rootRect.top
        const bottomVisible = containerRect.bottom > rootRect.top + 32

        if (topGone && bottomVisible) {
          floating.style.top = `${rootRect.top}px`
          floating.style.left = `${containerRect.left}px`
          floating.style.width = `${containerRect.width}px`
          floating.style.opacity = '1'
          floating.style.pointerEvents = 'auto'
          floating.style.boxShadow = '0 2px 8px 0 rgb(0 0 0 / 0.08)'
          header.style.visibility = 'hidden'
        } else {
          hide()
        }
      }

      let rafId = 0
      const syncRaf = () => {
        cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(sync)
      }

      root.addEventListener('scroll', sync, { passive: true })

      const ro = new ResizeObserver(syncRaf)
      ro.observe(container)
      ro.observe(scrollable)

      rafId = requestAnimationFrame(sync)

      return () => {
        root.removeEventListener('scroll', sync)
        ro.disconnect()
        cancelAnimationFrame(rafId)
        if (header) header.style.visibility = 'visible'
      }
    }, [scrollContainerRef, collapsed])

    const toggle = useCallback(() => setCollapsed((c) => !c), [])

    const copy = useCallback(async () => {
      const text = rawCode || highlightedHtml.replace(/<[^>]+>/g, '')
      if (text) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        toast.success('Copied')
        setTimeout(() => setCopied(false), 2000)
      }
    }, [rawCode, highlightedHtml])

    const headerContent = (
      <>
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronRight
            className={cn(
              'size-3.5 transition-transform duration-150',
              !collapsed && 'rotate-90'
            )}
          />
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-background/60 text-muted-foreground border border-border/40">
            {language || 'code'}
          </span>
        </button>
        <div className="flex items-center gap-1">
          {isStreaming && (
            <span className="size-1.5 rounded-full bg-primary animate-pulse mr-1" />
          )}
          <button
            type="button"
            onClick={copy}
            disabled={isLoading}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </>
    )

    return (
      <>
        {/* Floating header portal */}
        {createPortal(
          <div
            ref={floatingRef}
            className="fixed z-50 flex items-center justify-between px-3 py-1.5 border border-border/70 bg-muted text-xs font-mono"
            style={{
              opacity: 0,
              pointerEvents: 'none',
              borderRadius: '0',
              boxShadow: '0 0 0 0 transparent',
              transition: 'opacity 120ms ease, box-shadow 150ms ease'
            }}
          >
            {headerContent}
          </div>,
          document.body
        )}

        {/* Main container */}
        <div
          ref={containerRef}
          className="my-3 rounded-xl border border-border/70 font-mono text-xs overflow-hidden"
        >
          {/* Static header */}
          <div
            ref={headerRef}
            className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted"
          >
            {headerContent}
          </div>

          {/* Collapsible body with grid animation */}
          <div
            className="overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateRows: collapsed ? '0fr' : '1fr',
              transition: 'grid-template-rows 0.18s ease'
            }}
          >
            <div className="min-h-0">
              <div
                ref={scrollableRef}
                className="overflow-auto max-h-96 thin-scrollbar"
              >
                <pre
                  ref={preRef}
                  // mt-0 mb-0 are super important m-0 does not suffice, DO NOT REMOVE
                  className="p-4 m-0 mt-0 mb-0 text-xs leading-relaxed"
                  style={{
                    fontSize: 13,
                    whiteSpace: 'pre',
                    fontFamily: 'inherit'
                  }}
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
              </div>
            </div>
          </div>
        </div>
      </>
    )
  },
  (prev, next) =>
    prev.highlightedHtml === next.highlightedHtml &&
    prev.artifactId === next.artifactId &&
    prev.language === next.language &&
    prev.isStreaming === next.isStreaming &&
    prev.scrollContainerRef === next.scrollContainerRef
)
