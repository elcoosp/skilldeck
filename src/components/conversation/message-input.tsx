/**
 * Message input — auto-growing textarea with draft persistence, slash commands,
 * skill mention (@), and file reference (#) entry points.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AtSign, Hash, Paperclip, Send, StopCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { useSendMessage } from '@/hooks/use-messages'
import type { UUID } from '@/lib/types'

interface MessageInputProps {
  conversationId: UUID
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isComposing, setIsComposing] = useState(false)

  const draft = useUIStore((s) => s.drafts[conversationId] ?? '')
  const setDraft = useUIStore((s) => s.setDraft)
  const clearDraft = useUIStore((s) => s.clearDraft)
  const isRunning = useUIStore((s) => s.agentRunning[conversationId] ?? false)

  const [content, setContent] = useState(draft)

  const sendMutation = useSendMessage(conversationId)

  // Sync draft → local state when conversation changes.
  useEffect(() => {
    setContent(draft)
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft with 500 ms debounce.
  useEffect(() => {
    const t = setTimeout(() => setDraft(conversationId, content), 500)
    return () => clearTimeout(t)
  }, [content, conversationId, setDraft])

  // Auto-grow textarea height.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [content])

  // Focus input when conversation changes.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [conversationId])

  const submit = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || isComposing || isRunning) return

    setContent('')
    clearDraft(conversationId)

    try {
      await sendMutation.mutateAsync(trimmed)
    } catch (err) {
      // Restore content so the user doesn't lose it.
      setContent(trimmed)
      console.error('Failed to send message:', err)
    }
  }, [
    content,
    isComposing,
    isRunning,
    conversationId,
    clearDraft,
    sendMutation
  ])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="p-3 space-y-2">
      <div className="relative flex items-end gap-2 rounded-xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring/50 px-3 py-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder={isRunning ? 'Agent is running…' : 'Type a message…'}
          disabled={isRunning}
          className={cn(
            'flex-1 min-h-[36px] max-h-[200px] resize-none border-0 shadow-none p-0 bg-transparent focus-visible:ring-0 text-sm'
          )}
          rows={1}
        />

        <Button
          size="icon-sm"
          className="shrink-0 mb-0.5"
          onClick={isRunning ? undefined : submit}
          disabled={(!content.trim() && !isRunning) || sendMutation.isPending}
          aria-label={isRunning ? 'Stop' : 'Send'}
        >
          {isRunning ? (
            <StopCircle className="size-3.5" />
          ) : (
            <Send className="size-3.5" />
          )}
        </Button>
      </div>

      {/* Input toolbar */}
      <div className="flex items-center gap-0.5 text-muted-foreground">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
          <AtSign className="size-3" />
          Skill
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
          <Hash className="size-3" />
          File
        </Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
          <Paperclip className="size-3" />
          Attach
        </Button>
        <span className="ml-auto text-xs opacity-50 pr-1">
          ↵ send · ⇧↵ newline
        </span>
      </div>
    </div>
  )
}
