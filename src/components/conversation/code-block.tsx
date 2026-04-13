// src/components/conversation/code-block.tsx

import { Check, ChevronDown, ChevronRight, ChevronUp, Copy, GitCompare, Hash, HelpCircle, Loader2, Play, Save, Search, Wrench, X } from 'lucide-react'
import type React from 'react'
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { useVirtualizer } from '@tanstack/react-virtual'

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
  highlightedLines: string[]
  isStreaming?: boolean
  scrollContainerRef?: React.RefObject<HTMLElement>
  lineCount: number
  filePath?: string | null
  tokenCount: number
  highlightedLineNumbers?: number[]
  minimapRgba?: number[] | Uint8Array
  minimapWidth?: number
  minimapHeight?: number
}

// ---------------------------------------------------------------------------
// Header subcomponent (unchanged)
// ---------------------------------------------------------------------------
const CodeBlockHeader = memo(function CodeBlockHeader({
  language,
  collapsed,
  toggle,
  lineCount,
  displayTokenCount,
  filePath,
  handleOpenArtifact,
  handleSaveToFile,
  canRun,
  isRunning,
  handleRun,
  rawCode,
  canDiff,
  setShowDiff,
  showLineNumbers,
  setShowLineNumbers,
  isLoading,
  copy,
  copied,
  showSearch,
  setShowSearch,
  searchQuery,
  setSearchQuery,
  clearHighlights,
  searchInputRef,
  handleExplain,
  handleFix,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
}: {
  language: string
  collapsed: boolean
  toggle: () => void
  lineCount: number
  displayTokenCount: string
  filePath?: string | null
  handleOpenArtifact: () => void
  handleSaveToFile: () => Promise<void>
  canRun: boolean
  isRunning: boolean
  handleRun: () => Promise<void>
  rawCode?: string
  canDiff: boolean
  setShowDiff: (show: boolean) => void
  showLineNumbers: boolean
  setShowLineNumbers: (show: boolean) => void
  isLoading: boolean
  copy: () => Promise<void>
  copied: boolean
  showSearch: boolean
  setShowSearch: (show: boolean) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  clearHighlights: () => void
  searchInputRef: React.RefObject<HTMLInputElement>
  handleExplain: () => void
  handleFix: () => void
  matchCount: number
  currentMatchIndex: number
  onNextMatch: () => void
  onPrevMatch: () => void
}) {
  return (
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
          onClick={() => setShowLineNumbers(!showLineNumbers)}
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
              className="h-6 px-2 text-xs border rounded bg-background w-32"
              onKeyDown={(e) => e.stopPropagation()}
            />
            {matchCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {currentMatchIndex + 1}/{matchCount}
              </span>
            )}
            <button
              type="button"
              onClick={onPrevMatch}
              disabled={matchCount === 0}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              title="Previous match"
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onNextMatch}
              disabled={matchCount === 0}
              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              title="Next match"
            >
              <ChevronDown className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSearch(false)
                setSearchQuery('')
                clearHighlights()
                setMatchLineIndices([])
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
})

// ---------------------------------------------------------------------------
// Main CodeBlock
// ---------------------------------------------------------------------------
export const CodeBlock: React.FC<CodeBlockProps> = memo(
  ({
    language,
    artifactId,
    highlightedLines,
    isStreaming = false,
    scrollContainerRef,
    lineCount,
    filePath,
    tokenCount,
    highlightedLineNumbers,
    minimapRgba: minimapRgbaProp,
    minimapWidth,
    minimapHeight,
  }) => {
    const [collapsed, setCollapsed] = useState(false)
    const [copied, setCopied] = useState(false)
    const { data: rawCode, isLoading } = useArtifactContent(artifactId)

    const containerRef = useRef<HTMLDivElement>(null)
    const headerRef = useRef<HTMLDivElement>(null)
    const floatingRef = useRef<HTMLDivElement>(null)
    const scrollableRef = useRef<HTMLDivElement>(null)
    const minimapCanvasRef = useRef<HTMLCanvasElement>(null)
    const thumbCanvasRef = useRef<HTMLCanvasElement>(null)
    const minimapImageDataRef = useRef<ImageData | null>(null)

    // Virtualization
    const parentRef = useRef<HTMLDivElement>(null)
    const preRef = useRef<HTMLPreElement>(null)
    const virtualizer = useVirtualizer({
      count: highlightedLines.length,
      getScrollElement: () => scrollableRef.current,
      estimateSize: () => showLineNumbers ? 24 : 21,
      overscan: 15,
    })

    const isUserScrolledUp = useRef(false)
    const isProgrammaticScroll = useRef(false)

    const [showLineNumbers, setShowLineNumbers] = useState(() => lineCount > 3)

    const [isRunning, setIsRunning] = useState(false)
    const [runOutput, setRunOutput] = useState<string[]>([])
    const [runError, setRunError] = useState<string[]>([])
    const [showOutput, setShowOutput] = useState(false)
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

    const [showDiff, setShowDiff] = useState(false)

    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)

    // Search navigation state
    const [matchLineIndices, setMatchLineIndices] = useState<number[]>([])
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

    const [thumbTop, setThumbTop] = useState(0)
    const [thumbHeight, setThumbHeight] = useState(20)
    const [isDragging, setIsDragging] = useState(false)
    const [minimapHovered, setMinimapHovered] = useState(false)

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

    const minimapRgba = minimapRgbaProp
      ? minimapRgbaProp instanceof Uint8Array
        ? minimapRgbaProp
        : new Uint8Array(minimapRgbaProp)
      : null

    // Draw minimap base image (only once)
    useEffect(() => {
      const canvas = minimapCanvasRef.current
      if (!canvas) return

      if (minimapRgba && minimapRgba.length > 0 && minimapWidth && minimapHeight) {
        canvas.width = minimapWidth
        canvas.height = minimapHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const imageData = new ImageData(
          new Uint8ClampedArray(minimapRgba),
          minimapWidth,
          minimapHeight
        )
        ctx.putImageData(imageData, 0, 0)
        minimapImageDataRef.current = imageData
      } else {
        canvas.width = 200
        canvas.height = lineCount * 2
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#333'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = '#666'
          for (let i = 0; i < lineCount; i++) {
            if (i % 2 === 0) {
              ctx.fillRect(0, i * 2, canvas.width, 2)
            }
          }
          minimapImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
        }
      }
    }, [minimapRgba, minimapWidth, minimapHeight, lineCount])

    // Draw thumb overlay on separate canvas (always visible)
    const drawThumb = useCallback(() => {
      const baseCanvas = minimapCanvasRef.current
      const thumbCanvas = thumbCanvasRef.current
      if (!baseCanvas || !thumbCanvas) return

      thumbCanvas.width = baseCanvas.width
      thumbCanvas.height = baseCanvas.height

      const ctx = thumbCanvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.fillRect(0, thumbTop, baseCanvas.width, thumbHeight)
    }, [thumbTop, thumbHeight])

    useEffect(() => {
      drawThumb()
    }, [drawThumb])

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
          setMatchLineIndices([])
        }
      }
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [showSearch])

    const clearHighlights = useCallback(() => {
      const container = parentRef.current
      if (!container) return
      container.querySelectorAll('.search-highlight').forEach(el => {
        const parent = el.parentNode
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ''), el)
          parent.normalize()
        }
      })
    }, [])

    // Highlight matches and collect line indices
    const applyHighlights = useCallback((query: string) => {
      const container = parentRef.current
      if (!container || !query.trim()) {
        clearHighlights()
        setMatchLineIndices([])
        setCurrentMatchIndex(0)
        return
      }

      // Clear existing highlights
      clearHighlights()

      const regex = new RegExp(escapeRegExp(query), 'gi')
      const matchLinesSet = new Set<number>()

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
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

          const lineElement = textNode.parentElement?.closest('[data-line-index]')
          if (lineElement) {
            const lineIndex = parseInt(lineElement.getAttribute('data-line-index') || '0', 10)
            matchLinesSet.add(lineIndex)
          }
        }
        if (lastIdx < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx)))
        }
        textNode.parentNode?.replaceChild(frag, textNode)
      }

      const sortedMatches = Array.from(matchLinesSet).sort((a, b) => a - b)
      setMatchLineIndices(sortedMatches)
      setCurrentMatchIndex(prev => sortedMatches.length > 0 ? Math.min(prev, sortedMatches.length - 1) : 0)
    }, [clearHighlights])

    // Apply highlights after each render when search is active
    useLayoutEffect(() => {
      if (!showSearch || !searchQuery) return
      const timeout = setTimeout(() => applyHighlights(searchQuery), 0)
      return () => clearTimeout(timeout)
    }, [highlightedLines, searchQuery, showSearch, applyHighlights])

    // Debounced typing effect
    useEffect(() => {
      if (!showSearch) return
      const timer = setTimeout(() => {
        applyHighlights(searchQuery)
      }, 150)
      return () => clearTimeout(timer)
    }, [searchQuery, applyHighlights, showSearch])

    // Improved scroll to match with retry to ensure element is rendered
    const scrollToMatchIndex = useCallback((index: number) => {
      const lineIndex = matchLineIndices[index]
      if (lineIndex === undefined) return

      // Force virtualizer to calculate the range for this index
      virtualizer.scrollToIndex(lineIndex, { align: 'center' })

      // Retry scrolling in case the element wasn't fully rendered
      const checkAndScroll = () => {
        const targetEl = document.querySelector(`[data-line-index="${lineIndex}"]`)
        if (targetEl) {
          targetEl.scrollIntoView({ block: 'center', behavior: 'auto' })
        } else {
          // If not found, try again after a short delay
          setTimeout(checkAndScroll, 20)
        }
      }
      setTimeout(checkAndScroll, 30)
    }, [matchLineIndices, virtualizer])

    const onNextMatch = useCallback(() => {
      if (matchLineIndices.length === 0) return
      const next = (currentMatchIndex + 1) % matchLineIndices.length
      setCurrentMatchIndex(next)
      scrollToMatchIndex(next)
    }, [currentMatchIndex, matchLineIndices, scrollToMatchIndex])

    const onPrevMatch = useCallback(() => {
      if (matchLineIndices.length === 0) return
      const prev = (currentMatchIndex - 1 + matchLineIndices.length) % matchLineIndices.length
      setCurrentMatchIndex(prev)
      scrollToMatchIndex(prev)
    }, [currentMatchIndex, matchLineIndices, scrollToMatchIndex])

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

      const timeoutId = setTimeout(() => {
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
          if (message.type === 'stdout' && message.line) {
            setRunOutput(prev => [...prev, message.line!])
          } else if (message.type === 'stderr' && message.line) {
            setRunError(prev => [...prev, message.line!])
          } else if (message.type === 'exit') {
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
      } catch (err) {
        toast.error(`Failed to run: ${err}`)
        setIsRunning(false)
        setShowOutput(false)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = undefined
        }
      }
    }, [isRunning, rawCode, language])

    // Scroll handling + thumb position
    useEffect(() => {
      const el = scrollableRef.current
      if (!el) return

      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = el
        if (!isProgrammaticScroll.current) {
          isUserScrolledUp.current = Math.abs(scrollHeight - clientHeight - scrollTop) >= 10
        }
        const ratio = scrollHeight > 0 ? scrollTop / scrollHeight : 0
        const visibleRatio = clientHeight / scrollHeight
        const baseCanvas = minimapCanvasRef.current
        if (baseCanvas) {
          const canvasHeight = baseCanvas.height
          setThumbTop(ratio * canvasHeight)
          setThumbHeight(Math.max(20, visibleRatio * canvasHeight))
        }
      }

      el.addEventListener('scroll', handleScroll, { passive: true })
      handleScroll()
      return () => el.removeEventListener('scroll', handleScroll)
    }, [])

    const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const canvas = minimapCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const y = e.clientY - rect.top
      const ratio = Math.min(1, Math.max(0, y / rect.height))
      const scrollable = scrollableRef.current
      if (scrollable) {
        scrollable.scrollTop = ratio * scrollable.scrollHeight
      }
    }, [])

    const onMouseDown = useCallback((e: React.MouseEvent) => {
      setIsDragging(true)
      handleMinimapClick(e)
    }, [handleMinimapClick])

    useEffect(() => {
      if (!isDragging) return
      const onMouseMove = (e: MouseEvent) => {
        const canvas = minimapCanvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const y = e.clientY - rect.top
        const ratio = Math.min(1, Math.max(0, y / rect.height))
        const scrollable = scrollableRef.current
        if (scrollable) {
          scrollable.scrollTop = ratio * scrollable.scrollHeight
        }
      }
      const onMouseUp = () => setIsDragging(false)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      return () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }
    }, [isDragging])

    // Auto-scroll during streaming
    useEffect(() => {
      if (!isStreaming || collapsed) return

      const scrollable = scrollableRef.current
      if (!scrollable) return

      let rafPending = false
      const scrollToBottom = () => {
        if (isUserScrolledUp.current || rafPending) return
        rafPending = true
        requestAnimationFrame(() => {
          isProgrammaticScroll.current = true
          scrollable.scrollTop = scrollable.scrollHeight
          requestAnimationFrame(() => {
            isProgrammaticScroll.current = false
            rafPending = false
          })
        })
      }

      const interval = setInterval(scrollToBottom, 100)
      return () => clearInterval(interval)
    }, [isStreaming, collapsed, highlightedLines.length])

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
      const text = rawCode || highlightedLines.join('\n')
      if (text) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        toast.success('Copied')
        setTimeout(() => setCopied(false), 2000)
      }
    }, [rawCode, highlightedLines])

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

    const firstVisibleIndex = virtualizer.getVirtualItems()[0]?.index ?? 0

    const headerProps = {
      language,
      collapsed,
      toggle,
      lineCount,
      displayTokenCount,
      filePath,
      handleOpenArtifact,
      handleSaveToFile,
      canRun,
      isRunning,
      handleRun,
      rawCode,
      canDiff,
      setShowDiff,
      showLineNumbers,
      setShowLineNumbers,
      isLoading,
      copy,
      copied,
      showSearch,
      setShowSearch,
      searchQuery,
      setSearchQuery,
      clearHighlights,
      searchInputRef,
      handleExplain,
      handleFix,
      matchCount: matchLineIndices.length,
      currentMatchIndex,
      onNextMatch,
      onPrevMatch,
    }

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
            <CodeBlockHeader {...headerProps} />
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
            <CodeBlockHeader {...headerProps} />
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
                  className={cn('p-3 mt-0 mb-0', showLineNumbers && 'code-with-lines')}
                  data-line-start={firstVisibleIndex + 1}
                  style={{ fontSize: 14, fontFamily: 'inherit' }}
                >
                  <div
                    ref={parentRef}
                    style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const line = highlightedLines[virtualRow.index]
                      const isHighlighted = highlightedLineNumbers?.includes(virtualRow.index + 1)
                      const isCurrentMatch = matchLineIndices[currentMatchIndex] === virtualRow.index
                      return (
                        <div
                          key={virtualRow.key}
                          data-index={virtualRow.index}
                          data-line-index={virtualRow.index}
                          ref={virtualizer.measureElement}
                          className={cn(
                            'absolute top-0 left-0 w-full',
                            showLineNumbers && 'line',
                            isHighlighted && 'highlighted-line',
                            isCurrentMatch && 'current-search-match'
                          )}
                          style={{
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <span
                            dangerouslySetInnerHTML={{ __html: line }}
                            style={{ display: 'inline', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </pre>
              </div>
              {showMinimap && (
                <div
                  className="absolute right-0 top-0 h-full"
                  style={{ width: '12px', cursor: 'pointer' }}
                  onMouseEnter={() => setMinimapHovered(true)}
                  onMouseLeave={() => setMinimapHovered(false)}
                >
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: minimapHovered ? '200px' : '12px',
                      height: '100%',
                      transition: 'width 0.15s ease',
                      pointerEvents: minimapHovered ? 'auto' : 'none',
                      overflow: 'hidden',
                    }}
                    onClick={handleMinimapClick}
                    onMouseDown={onMouseDown}
                  >
                    <canvas
                      ref={minimapCanvasRef}
                      style={{
                        display: 'block',
                        width: '200px',
                        height: '100%',
                        imageRendering: 'pixelated',
                        position: 'absolute',
                        right: 0,
                      }}
                    />
                    <canvas
                      ref={thumbCanvasRef}
                      style={{
                        display: 'block',
                        width: '200px',
                        height: '100%',
                        position: 'absolute',
                        right: 0,
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
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
    prev.highlightedLines === next.highlightedLines &&
    prev.artifactId === next.artifactId &&
    prev.language === next.language &&
    prev.isStreaming === next.isStreaming &&
    prev.scrollContainerRef === next.scrollContainerRef &&
    prev.lineCount === next.lineCount &&
    prev.filePath === next.filePath &&
    prev.tokenCount === next.tokenCount &&
    prev.highlightedLineNumbers === next.highlightedLineNumbers &&
    prev.minimapRgba === next.minimapRgba &&
    prev.minimapWidth === next.minimapWidth &&
    prev.minimapHeight === next.minimapHeight
)
