/**
 * Message input — auto-growing textarea with draft persistence, slash commands,
 * skill mention (@), file reference (#) entry points, and file attachments.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AtSign, Hash, Paperclip, Send, StopCircle, X } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
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

    setContent('')
    setSelectedFiles([])
    clearDraft(conversationId)

    try {
      await sendMutation.mutateAsync(finalContent)
    } catch (err) {
      // Restore content so the user doesn't lose it.
      setContent(finalContent)
      console.error('Failed to send message:', err)
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
            'flex-1 min-h-[36px] max-h-[200px] resize-none border-0 shadow-none p-0 bg-transparent focus-visible:ring-0 text-sm'
          )}
          rows={1}
        />

        <Button
          size="icon-sm"
          className="shrink-0 mb-0.5"
          onClick={isRunning ? undefined : submit}
          disabled={(!content.trim() && selectedFiles.length === 0 && !isRunning) || sendMutation.isPending}
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
