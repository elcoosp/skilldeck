// src/components/conversation/code-block.tsx

import { Check, ChevronRight, Copy, GitCompare, Hash, Loader2, Play, Save } from 'lucide-react'
import type React from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '@/components/ui/toast'
import { useArtifactContent } from '@/hooks/use-artifact-content'
import { cn } from '@/lib/utils'
import { save } from '@tauri-apps/plugin-dialog'
import { commands } from '@/lib/bindings'
import { listen } from '@tauri-apps/api/event'
import type { RunCodeEvent } from '@/lib/events'
import { useQuery } from '@tanstack/react-query'
import { VersionDiffModal } from '@/components/artifacts/version-diff-modal'

const SUPPORTED_RUN_LANGUAGES = new Set(['python', 'py', 'javascript', 'js', 'bash', 'sh', 'ruby', 'rb'])

interface CodeBlockProps {
  language: string
  artifactId: string
  highlightedHtml: string
  isStreaming?: boolean
  scrollContainerRef?: React.RefObject<HTMLElement>
  lineCount: number
  filePath?: string | null
  tokenCount: number                   // new
}

export const CodeBlock: React.FC<CodeBlockProps> = memo(
  ({
    language,
    artifactId,
    highlightedHtml,
    isStreaming = false,
    scrollContainerRef,
    lineCount,
    filePath,
    tokenCount,
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

    const [showLineNumbers, setShowLineNumbers] = useState(() => lineCount > 3)

    // Run code state
    const [isRunning, setIsRunning] = useState(false)
    const [runOutput, setRunOutput] = useState<string[]>([])
    const [runError, setRunError] = useState<string[]>([])
    const [runId, setRunId] = useState<string | null>(null)
    const [showOutput, setShowOutput] = useState(false)

    // Diff view state
    const [showDiff, setShowDiff] = useState(false)

    const canRun = SUPPORTED_RUN_LANGUAGES.has(language)

    // Query artifact versions for diff
    const { data: versions } = useQuery({
      queryKey: ['artifact-versions', artifactId],
      queryFn: async () => {
        const res = await commands.listArtifactVersions(artifactId)
        if (res.status === 'ok') return res.data
        throw new Error(res.error)
      },
      enabled: !!artifactId,
    })

    const canDiff = (versions?.length ?? 0) > 1

    // Rough heuristic fallback if token count is zero (e.g., legacy artifacts)
    const displayTokenCount = tokenCount > 0
      ? `${tokenCount} tok`
      : `~${Math.ceil((rawCode?.length ?? 0) / 4)} tok`

    useEffect(() => {
      if (!runId) return
      const unlisten = listen<RunCodeEvent>('run-code-event', (event) => {
        if (event.payload.run_id !== runId) return
        if (event.payload.type === 'stdout') {
          setRunOutput(prev => [...prev, event.payload.line])
        } else if (event.payload.type === 'stderr') {
          setRunError(prev => [...prev, event.payload.line])
        } else if (event.payload.type === 'exit') {
          setIsRunning(false)
          setRunId(null)
          if (event.payload.code !== 0) {
            setRunError(prev => [...prev, `Process exited with code ${event.payload.code} in ${event.payload.elapsed_ms}ms`])
          }
        }
      })
      return () => { unlisten.then(fn => fn()) }
    }, [runId])

    const handleRun = useCallback(async () => {
      if (isRunning) return
      if (!rawCode) {
        toast.error('Code content not loaded')
        return
      }
      setIsRunning(true)
      setRunOutput([])
      setRunError([])
      setShowOutput(true)
      try {
        const id = await commands.runCodeSnippet(language, rawCode, null)
        setRunId(id)
      } catch (err) {
        toast.error(`Failed to run: ${err}`)
        setIsRunning(false)
        setShowOutput(false)
      }
    }, [isRunning, rawCode, language])

    // Apply/remove the line‑number class whenever toggled or when the HTML changes.
    useEffect(() => {
      const pre = preRef.current
      if (!pre) return
      if (showLineNumbers) {
        pre.classList.add('code-with-lines')
      } else {
        pre.classList.remove('code-with-lines')
      }
    }, [showLineNumbers, highlightedHtml])

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

    // ─── Floating header: portal + getBoundingClientRect (mirrors CodePre) ───
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
        // Only show floating header when content actually overflows
        const codeOverflows = scrollable.scrollHeight > scrollable.clientHeight
        if (collapsed || !codeOverflows) {
          hide()
          return
        }

        const rootRect = root.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()

        // Guard against invisible/unmeasured containers
        if (rootRect.width === 0 || rootRect.height === 0) {
          hide()
          return
        }

        const topGone = containerRect.top < rootRect.top
        const bottomVisible = containerRect.bottom > rootRect.top + 32

        if (topGone && bottomVisible) {
          // Position the portal element to sit at the top of the scroll container,
          // spanning the exact width of the code block container
          floating.style.top = `${rootRect.top}px`
          floating.style.left = `${containerRect.left}px`
          floating.style.width = `${containerRect.width}px`
          floating.style.opacity = '1'
          floating.style.pointerEvents = 'auto'
          floating.style.borderRadius = '0'
          floating.style.boxShadow = '0 4px 12px 0 rgb(0 0 0 / 0.15)'
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
        // Always restore visibility on cleanup
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

    const handleSaveToFile = useCallback(async () => {
      try {
        let path = filePath ?? undefined
        if (!path) {
          const selected = await save({
            defaultPath: `artifact.${language}`,
            filters: [{ name: 'All Files', extensions: ['*'] }],
          })
          if (!selected) return
          path = selected
        }
        await commands.writeArtifactToFile(artifactId, path)
        toast.success(`Saved to ${path}`)
      } catch (err) {
        toast.error(`Failed to save: ${err}`)
      }
    }, [artifactId, filePath, language])

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
          <span>{language || 'code'}</span>
        </button>
        <div className="flex items-center gap-1">
          {/* Line count + token badge */}
          <span className="text-[10px] text-muted-foreground mr-2">
            {lineCount} lines · {displayTokenCount}
          </span>
          {/* Filename pill */}
          {filePath && (
            <span
              className="text-[10px] font-mono text-muted-foreground truncate max-w-[150px]"
              title={filePath}
            >
              {filePath.split('/').pop()}
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveToFile}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Save to file"
          >
            <Save className="size-3.5" />
          </button>
          {canRun && (
            <button
              type="button"
              onClick={handleRun}
              disabled={isRunning || !rawCode}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
              title="Run code snippet"
            >
              {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            </button>
          )}
          {canDiff && (
            <button
              type="button"
              onClick={() => setShowDiff(true)}
              className="p-1 text-muted-foreground hover:text-foreground"
              title="Compare with previous versions"
            >
              <GitCompare className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowLineNumbers(v => !v)}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Toggle line numbers"
          >
            <Hash className="size-3.5" />
          </button>
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
            className="fixed z-50 flex items-center justify-between px-3 py-1.5 border border-border bg-muted text-xs font-mono"
            style={{
              opacity: 0,
              pointerEvents: 'none',
              borderRadius: 'var(--radius)',
              boxShadow: '0 0 0 0 transparent',
              transition: 'border-radius 200ms ease, box-shadow 200ms ease'
            }}
          >
            {headerContent}
          </div>,
          document.body
        )}

        <div
          ref={containerRef}
          className="my-3 rounded-lg border border-border font-mono text-xs"
        >
          {/* Static header */}
          <div
            ref={headerRef}
            className={cn(
              'flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted',
              collapsed ? 'rounded-lg' : 'rounded-t-lg'
            )}
          >
            {headerContent}
          </div>

          {/* Collapse wrapper */}
          <div
            className="overflow-hidden rounded-b-lg"
            style={{
              maxHeight: collapsed ? 0 : 384,
              transition: 'max-height 0.18s ease'
            }}
          >
            <div
              ref={scrollableRef}
              className="overflow-auto max-h-96 thin-scrollbar"
            >
              <pre
                ref={preRef}
                className="p-3 m-0 mt-0 mb-0 text-xs leading-relaxed"
                style={{
                  fontSize: 14,
                  whiteSpace: 'pre',
                  fontFamily: 'inherit'
                }}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </div>
          </div>

          {/* Output panel */}
          {showOutput && (
            <div className="border-t border-border bg-muted/30 p-2 max-h-48 overflow-auto thin-scrollbar">
              {runOutput.map((line, i) => (
                <div key={`out-${i}`} className="text-xs font-mono whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
              {runError.map((line, i) => (
                <div key={`err-${i}`} className="text-xs font-mono text-destructive whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
              {!isRunning && runOutput.length === 0 && runError.length === 0 && (
                <div className="text-xs text-muted-foreground">No output</div>
              )}
            </div>
          )}
        </div>

        {/* Diff Modal */}
        {showDiff && versions && (
          <VersionDiffModal
            open={showDiff}
            onClose={() => setShowDiff(false)}
            versions={versions}
          />
        )}
      </>
    )
  },
  (prev, next) =>
    prev.highlightedHtml === next.highlightedHtml &&
    prev.artifactId === next.artifactId &&
    prev.language === next.language &&
    prev.isStreaming === next.isStreaming &&
    prev.scrollContainerRef === next.scrollContainerRef &&
    prev.lineCount === next.lineCount &&
    prev.filePath === next.filePath &&
    prev.tokenCount === next.tokenCount
)
