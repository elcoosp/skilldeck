// src/components/conversation/message-input.tsx
/**
 * Message input — auto-growing textarea with draft persistence, slash commands,
 * skill mention (@), file reference (#) entry points, and file attachments.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AtSign, Hash, Paperclip, Send, StopCircle, X } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { useSendMessage } from '@/hooks/use-messages'
import type { UUID } from '@/lib/types'

interface MessageInputProps {
  conversationId: UUID
}

interface FileChip {
  path: string
  name: string
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileChip[]>([])
  const [isSending, setIsSending] = useState(false)

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

  const pickFiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: 'All Files', extensions: ['*'] }]
    })
    if (!selected) return
    const paths = Array.isArray(selected) ? selected : [selected]
    const newFiles = paths.map(p => ({
      path: p,
      name: p.split('/').pop() || p
    }))
    setSelectedFiles(prev => [...prev, ...newFiles])
  }, [])

  const removeFile = useCallback((pathToRemove: string) => {
    setSelectedFiles(prev => prev.filter(f => f.path !== pathToRemove))
  }, [])

  const submit = useCallback(async () => {
    let finalContent = content.trim()

    // Append file tags
    for (const file of selectedFiles) {
      finalContent += `\n<file path="${file.path}" />`
    }

    if (!finalContent.trim() || isComposing || isRunning) return

    setIsSending(true)
    setContent('')
    setSelectedFiles([])
    clearDraft(conversationId)

    try {
      await sendMutation.mutateAsync(finalContent)
    } catch (err) {
      // Restore content so the user doesn't lose it.
      setContent(finalContent)
      console.error('Failed to send message:', err)
    } finally {
      setIsSending(false)
    }
  }, [content, selectedFiles, isComposing, isRunning, conversationId, clearDraft, sendMutation])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="p-3 space-y-2">
      {/* File chips */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedFiles.map(file => (
            <div
              key={file.path}
              className="inline-flex items-center gap-1 bg-muted/70 text-xs rounded-full px-2 py-0.5"
            >
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button
                onClick={() => removeFile(file.path)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

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
            'flex-1 min-h-[36px] max-h-[200px] resize-none border-0 shadow-none bg-transparent focus-visible:ring-0 text-sm',
            'leading-6 py-2 px-0 overflow-y-hidden'
          )}
          rows={1}
        />

        <Button
          size="icon-sm"
          className="shrink-0 mb-0.5"
          onClick={submit}
          disabled={(!content.trim() && selectedFiles.length === 0 && !isRunning) || sendMutation.isPending || isSending}
          aria-label={isRunning ? 'Stop' : 'Send'}
        >
          <AnimatePresence mode="wait">
            {isSending ? (
              <motion.div
                key="sending"
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
              >
                <Send className="size-3.5" />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                {isRunning ? (
                  <StopCircle className="size-3.5" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </div>

      {/* Input toolbar */}
      <div className="flex items-center gap-0.5 text-muted-foreground">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
          <AtSign className="size-3" />
          Skill
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={pickFiles}
        >
          <Hash className="size-3" />
          File
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={pickFiles}
        >
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
