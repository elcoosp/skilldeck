// src/components/conversation/code-block.tsx

import { Check, ChevronRight, Copy, GitCompare, Hash, HelpCircle, Loader2, Play, Save, Search, Wrench, X } from 'lucide-react'
import type React from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from '@/components/ui/toast'
import { useArtifactContent } from '@/hooks/use-artifact-content'
import { cn } from '@/lib/utils'
import { save } from '@tauri-apps/plugin-dialog'
import { commands } from '@/lib/bindings'
import { Channel } from '@tauri-apps/api/core'
import { useQuery } from '@tanstack/react-query'
import { VersionDiffModal } from '@/components/artifacts/version-diff-modal'
import { useUILayoutStore } from '@/store/ui-layout'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { useSendMessage } from '@/hooks/use-messages'
import { useConversationStore } from '@/store/conversation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import Ansi from '@curvenote/ansi-to-react'

const SUPPORTED_RUN_LANGUAGES = new Set(['python', 'py', 'javascript', 'js', 'bash', 'sh', 'ruby', 'rb'])

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface RunOutput {
  type: 'stdout' | 'stderr' | 'exit'
  line?: string
  code?: number
  elapsed_ms?: number
}

interface CodeBlockProps {
  language: string
  artifactId: string
  highlightedHtml: string
  isStreaming?: boolean
  scrollContainerRef?: React.RefObject<HTMLElement>
  lineCount: number
  filePath?: string | null
  tokenCount: number
  highlightedLines?: number[]
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
    highlightedLines,
  }) => {
    const [collapsed, setCollapsed] = useState(false)
    const [copied, setCopied] = useState(false)
    const { data: rawCode, isLoading } = useArtifactContent(artifactId)

    const containerRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)
    const floatingRef = useRef<HTMLDivElement>(null)
    const scrollableRef = useRef<HTMLDivElement>(null)
    const preRef = useRef<HTMLPreElement>(null)
    const minimapThumbRef = useRef<HTMLDivElement>(null)

    const isUserScrolledUp = useRef(false)
    const isProgrammaticScroll = useRef(false)

    const [showLineNumbers, setShowLineNumbers] = useState(() => lineCount > 3)

    const [isRunning, setIsRunning] = useState(false)
    const [runOutput, setRunOutput] = useState<string[]>([])
    const [runError, setRunError] = useState<string[]>([])
    const [showOutput, setShowOutput] = useState(false)

    const [showDiff, setShowDiff] = useState(false)

    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)

    const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

    const canRun = SUPPORTED_RUN_LANGUAGES.has(language)

    const setRightTab = useUILayoutStore((s) => s.setRightTab)
    const setSelectedArtifactId = useUIEphemeralStore((s) => s.setSelectedArtifactId)

    const activeConversationId = useConversationStore((s) => s.activeConversationId)
    const activeBranchId = useConversationStore((s) => s.activeBranchId)
    const sendMessage = useSendMessage(activeConversationId!, activeBranchId)

    const handleOpenArtifact = useCallback(() => {
      if (artifactId) {
        setRightTab('artifacts')
        setTimeout(() => setSelectedArtifactId(artifactId), 150)
      }
    }, [artifactId, setRightTab, setSelectedArtifactId])

    const handleExplain = useCallback(() => {
      if (!activeConversationId) {
        toast.error('No active conversation')
        return
      }
      const prompt = `Explain this ${language} code:\n\`\`\`${language}\n${rawCode}\n\`\`\``
      sendMessage.mutate({ content: prompt, thinking: false })
    }, [activeConversationId, language, rawCode, sendMessage])

    const handleFix = useCallback(() => {
      if (!activeConversationId) {
        toast.error('No active conversation')
        return
      }
      const prompt = `The following ${language} code has an issue. Please fix it and explain the changes:\n\`\`\`${language}\n${rawCode}\n\`\`\``
      sendMessage.mutate({ content: prompt, thinking: false })
    }, [activeConversationId, language, rawCode, sendMessage])

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

    const displayTokenCount = tokenCount > 0
      ? `${tokenCount} tok`
      : `~${Math.ceil((rawCode?.length ?? 0) / 4)} tok`

    // Search keyboard shortcut
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const container = containerRef.current
        if (!container) return
        const activeElement = document.activeElement
        const isFocused = container === activeElement || container.contains(activeElement)
        if (!isFocused) return

        if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
          e.preventDefault()
          e.stopPropagation()
          setShowSearch(true)
          setTimeout(() => searchInputRef.current?.focus(), 50)
        }
        if (e.key === 'Escape' && showSearch) {
          e.preventDefault()
          e.stopPropagation()
          setShowSearch(false)
          setSearchQuery('')
          clearHighlights()
        }
      }
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [showSearch])

    const clearHighlights = useCallback(() => {
      const pre = preRef.current
      if (!pre) return
      pre.querySelectorAll('.search-highlight').forEach(el => {
        const parent = el.parentNode
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ''), el)
          parent.normalize()
        }
      })
    }, [])

    const highlightMatches = useCallback((query: string) => {
      const pre = preRef.current
      if (!pre || !query.trim()) {
        clearHighlights()
        return
      }
      clearHighlights()
      const regex = new RegExp(escapeRegExp(query), 'gi')
      const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
          regex.test(node.textContent || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
      })
      const textNodes: Text[] = []
      let node = walker.nextNode()
      while (node) {
        textNodes.push(node as Text)
        node = walker.nextNode()
      }
      for (const textNode of textNodes) {
        const text = textNode.textContent || ''
        const frag = document.createDocumentFragment()
        let lastIdx = 0
        let match
        regex.lastIndex = 0
        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIdx) {
            frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)))
          }
          const mark = document.createElement('mark')
          mark.className = 'search-highlight'
          mark.textContent = match[0]
          frag.appendChild(mark)
          lastIdx = regex.lastIndex
          if (match[0].length === 0) regex.lastIndex++
        }
        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx)))
        }
        textNode.parentNode?.replaceChild(frag, textNode)
      }
    }, [clearHighlights])

    useEffect(() => {
      highlightMatches(searchQuery)
    }, [searchQuery, highlightedHtml, highlightMatches])

    useEffect(() => {
      const pre = preRef.current
      if (!pre || !highlightedLines?.length) return
      const lines = pre.querySelectorAll('.line')
      lines.forEach((line, index) => {
        const lineNumber = index + 1
        if (highlightedLines.includes(lineNumber)) {
          line.classList.add('highlighted-line')
        } else {
          line.classList.remove('highlighted-line')
        }
      })
    }, [highlightedLines, highlightedHtml])

    const handleRun = useCallback(async () => {
      if (isRunning) return
      if (!rawCode) {
        toast.error('Code content not loaded')
        return
      }

      console.log('[CodeBlock] Starting run via channel')
      setIsRunning(true)
      setRunOutput([])
      setRunError([])
      setShowOutput(true)

      const timeoutId = setTimeout(() => {
        console.warn('[CodeBlock] Run timed out')
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = undefined
        }
        setIsRunning(false)
        setRunError(prev => [...prev, 'Execution timed out after 30 seconds'])
      }, 30000)
      timeoutRef.current = timeoutId

      try {
        const channel = new Channel<RunOutput>()
        channel.onmessage = (message) => {
          console.log('[CodeBlock] Channel message:', message)
          if (message.type === 'stdout' && message.line) {
            setRunOutput(prev => [...prev, message.line!])
          } else if (message.type === 'stderr' && message.line) {
            setRunError(prev => [...prev, message.line!])
          } else if (message.type === 'exit') {
            console.log('[CodeBlock] Received exit, code:', message.code)
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
              timeoutRef.current = undefined
            }
            setIsRunning(false)
            if (message.code !== 0) {
              setRunError(prev => [...prev, `Process exited with code ${message.code} in ${message.elapsed_ms}ms`])
            }
          }
        }

        await commands.runCodeSnippet(channel, language, rawCode, null)
        console.log('[CodeBlock] Command completed')
      } catch (err) {
        console.error('[CodeBlock] Run command failed:', err)
        toast.error(`Failed to run: ${err}`)
        setIsRunning(false)
        setShowOutput(false)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = undefined
        }
      }
    }, [isRunning, rawCode, language])

    // Line numbers toggle
    useEffect(() => {
      const pre = preRef.current
      if (!pre) return
      if (showLineNumbers) {
        pre.classList.add('code-with-lines')
      } else {
        pre.classList.remove('code-with-lines')
      }
    }, [showLineNumbers, highlightedHtml])

    // Merged scroll listener
    useEffect(() => {
      const el = scrollableRef.current
      if (!el) return

      const handleScroll = () => {
        if (!isProgrammaticScroll.current) {
          const { scrollTop, scrollHeight, clientHeight } = el
          isUserScrolledUp.current = Math.abs(scrollHeight - clientHeight - scrollTop) >= 10
        }
        const thumb = minimapThumbRef.current
        if (thumb) {
          const { scrollTop, scrollHeight, clientHeight } = el
          const ratio = scrollHeight > 0 ? scrollTop / scrollHeight : 0
          const thumbH = Math.max(20, (clientHeight / scrollHeight) * clientHeight)
          thumb.style.height = `${thumbH}px`
          thumb.style.top = `${ratio * clientHeight}px`
        }
      }

      el.addEventListener('scroll', handleScroll, { passive: true })
      handleScroll()
      return () => el.removeEventListener('scroll', handleScroll)
    }, [highlightedHtml])

    const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const el = scrollableRef.current
      if (!el) return
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const ratio = y / rect.height
      el.scrollTop = ratio * el.scrollHeight
    }, [])

    // Auto-scroll during streaming
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
      observer.observe(pre, { childList: true, subtree: true, characterData: true })
      scrollToBottom()
      return () => observer.disconnect()
    }, [isStreaming, collapsed])

    // Floating header
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
        const codeOverflows = scrollable.scrollHeight > scrollable.clientHeight
        if (collapsed || !codeOverflows) {
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
        const defaultPath = filePath ?? `artifact.${language}`
        const selected = await save({
          defaultPath,
          filters: [{ name: 'All Files', extensions: ['*'] }],
        })
        if (!selected) return
        await commands.writeArtifactToFile(artifactId, selected)
        toast.success(`Saved to ${selected}`)
      } catch (err) {
        toast.error(`Failed to save: ${err}`)
      }
    }, [artifactId, filePath, language])

    const showMinimap = lineCount > 60 && !collapsed

    const headerContent = (
      <>
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronRight
            className={cn('size-3.5 transition-transform duration-150', !collapsed && 'rotate-90')}
          />
          <span>{language || 'code'}</span>
        </button>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-2">
            {lineCount} lines · {displayTokenCount}
          </span>
          {filePath ? (
            <button
              type="button"
              onClick={handleOpenArtifact}
              className="text-[10px] font-mono text-primary hover:underline truncate max-w-[150px]"
              title={`Open ${filePath} in artifacts`}
            >
              {filePath.split('/').pop()}
            </button>
          ) : null}
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
          {!showSearch && (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="p-1 text-muted-foreground hover:text-foreground"
              title="Find in code (Cmd+F)"
            >
              <Search className="size-3.5" />
            </button>
          )}
          {showSearch && (
            <>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Find in code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-6 px-2 text-xs border rounded bg-background"
                onKeyDown={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={() => {
                  setShowSearch(false)
                  setSearchQuery('')
                  clearHighlights()
                }}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </>
          )}
          <div className="flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleExplain}
              className="p-1 text-muted-foreground hover:text-foreground"
              title="Explain this code"
            >
              <HelpCircle className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFix}
              className="p-1 text-muted-foreground hover:text-foreground"
              title="Ask AI to fix"
            >
              <Wrench className="size-3.5" />
            </button>
          </div>
        </div>
      </>
    )

    return (
      <>
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
          tabIndex={0}
          className="my-3 rounded-lg border border-border font-mono text-xs group/code-header focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <div
            ref={headerRef}
            className={cn(
              'flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted',
              collapsed ? 'rounded-lg' : 'rounded-t-lg'
            )}
          >
            {headerContent}
          </div>

          <div
            className="overflow-hidden rounded-b-lg"
            style={{
              maxHeight: collapsed ? 0 : 384,
              transition: 'max-height 0.18s ease'
            }}
          >
            <div className="relative bg-transparent">
              <div
                ref={scrollableRef}
                className={cn(
                  'overflow-auto max-h-96 thin-scrollbar code-scroll-area',
                  showMinimap && 'hide-y-scrollbar'
                )}
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
              {showMinimap && (
                <div
                  className="absolute right-0 top-0 w-1.5 h-full cursor-pointer minimap-strip"
                  style={{ backgroundColor: 'var(--border)', opacity: 0.4 }}
                  onClick={handleMinimapClick}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                >
                  <div
                    ref={minimapThumbRef}
                    className="absolute w-full bg-primary/50 rounded-sm"
                    style={{ height: 20, top: 0 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Run Output Modal */}
        <Dialog open={showOutput} onOpenChange={setShowOutput}>
          <DialogContent className="max-w-3xl h-[500px] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Code Execution Output</span>
                {isRunning && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="stdout" className="flex-1 flex flex-col min-h-0 mt-2">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="stdout" className="flex-1">
                  stdout {runOutput.length > 0 && `(${runOutput.length})`}
                </TabsTrigger>
                <TabsTrigger value="stderr" className="flex-1">
                  stderr {runError.length > 0 && `(${runError.length})`}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="stdout" className="flex-1 min-h-0 mt-2">
                <ScrollArea className="h-full rounded-md border bg-muted/30 p-3">
                  {runOutput.length === 0 ? (
                    <p className="text-muted-foreground text-sm italic">No output</p>
                  ) : (
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      <Ansi>{runOutput.join('\n')}</Ansi>
                    </pre>
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="stderr" className="flex-1 min-h-0 mt-2">
                <ScrollArea className="h-full rounded-md border bg-muted/30 p-3">
                  {runError.length === 0 ? (
                    <p className="text-muted-foreground text-sm italic">No errors</p>
                  ) : (
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all text-destructive">
                      <Ansi>{runError.join('\n')}</Ansi>
                    </pre>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

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
    prev.tokenCount === next.tokenCount &&
    prev.highlightedLines === next.highlightedLines
)
