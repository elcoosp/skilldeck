import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  ChevronRight,
  Loader2,
  MessageSquare,
  Search,
  X
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDebounce } from 'use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import { commands } from '@/lib/bindings'
import { cn } from '@/lib/utils'
import { useConversationStore } from '@/store/conversation'

// Local type for the UI. We'll map from the backend response.
interface GlobalSearchResult {
  message_id: string
  conversation_id: string
  conversation_title: string | null
  created_at: string
  message_snippet: string
}

interface GlobalSearchModalProps {
  open: boolean
  onClose: () => void
}

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery] = useDebounce(query, 300)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const setActiveConversation = useConversationStore((s) => s.setActiveConversation)
  const setScrollToMessageId = useConversationStore((s) => s.setScrollToMessageId)

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return []
      // Use a dummy conversation_id to satisfy the type (backend may ignore it for global search)
      // This is a temporary workaround; replace with actual global search API when available.
      const res = await commands.searchMessages({
        conversation_id: '', // dummy
        query: debouncedQuery,
        limit: '50'
      })
      if (res.status === 'ok') {
        // Map the backend result to our UI type. Since the actual response may not have
        // these fields, we use a type assertion. Replace with proper mapping once the
        // real global search API is defined.
        const data = res.data as any[]
        return data.map((item): GlobalSearchResult => ({
          message_id: item.message_id || item.id,
          conversation_id: item.conversation_id || item.conversationId,
          conversation_title: item.conversation_title || item.title || null,
          created_at: item.created_at || item.timestamp,
          message_snippet: item.message_snippet || item.snippet || ''
        }))
      }
      throw new Error(res.error)
    },
    enabled: open && debouncedQuery.length > 0,
    staleTime: 10_000
  })

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onClose])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        handleSelectResult(results[selectedIndex])
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, results, selectedIndex])

  const handleSelectResult = (result: GlobalSearchResult) => {
    setActiveConversation(result.conversation_id)
    setScrollToMessageId(result.message_id)
    onClose()
  }

  if (!open) return null

  const modifierKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm">
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-2xl overflow-hidden"
      >
        {/* Search header */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            placeholder="Search all conversations…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            className="flex-1 h-8 border-0 focus-visible:ring-0 px-0"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setQuery('')}
              aria-label="Clear"
            >
              <X className="size-3.5" />
            </Button>
          )}
          <Kbd key={`${modifierKey}+K`} />
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[400px]">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-12"
              >
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </motion.div>
            ) : results.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                {query ? 'No results found.' : 'Type to search across all conversations.'}
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="divide-y divide-border"
              >
                {results.map((result, index) => (
                  <button
                    type="button"
                    key={result.message_id}
                    className={cn(
                      'w-full text-left p-3 hover:bg-muted/50 transition-colors',
                      index === selectedIndex && 'bg-primary/10'
                    )}
                    onClick={() => handleSelectResult(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <span className="font-medium text-foreground truncate">
                            {result.conversation_title || 'Untitled'}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="size-3" />
                            {new Date(result.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p
                          className="text-sm leading-relaxed line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: result.message_snippet }}
                        />
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer hint */}
        <div className="p-2 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
          <span>↑↓ to navigate · ↵ to open</span>
          <Kbd key="Esc" />
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
