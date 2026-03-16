// src/components/conversation/message-input.tsx
/**
 * Message input — auto-growing textarea with draft persistence, slash commands,
 * skill mention (@), file reference (#) entry points, and file attachments.
 *
 * Context injection: type `@` to search skills, `#` to browse the file system.
 * Selected items appear as chips above the textarea and are cleared on send.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AtSign, Hash, Paperclip, Send, StopCircle, X } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { useSendMessage } from '@/hooks/use-messages'
import { useRegistrySkills } from '@/hooks/use-skills'
import { commands } from '@/lib/bindings'
import type { RegistrySkillData } from '@/lib/bindings'
import { useChatContextStore } from '@/store/chat-context-store'
import { FileMentionPicker } from '@/components/chat/file-mention-picker'
import { ChatCommandPalette } from '@/components/chat/chat-command-palette'
import { AttachedItemsList } from '@/components/chat/attached-items-list'
import { SecurityWarningDialog } from '@/components/chat/security-warning-dialog'
import type { FileEntry, FolderCounts, TriggerState } from '@/types/chat-context'
import type { UUID } from '@/lib/types'
import { useWorkspaces } from '@/hooks/use-workspaces'

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

  // ── Workspace context ───────────────────────────────────────────────────
  const activeWorkspaceId = useUIStore((s) => s.activeWorkspaceId)
  const { data: workspaces } = useWorkspaces()
  const activeWorkspace = workspaces?.find(w => w.id === activeWorkspaceId)
  const workspaceRoot = activeWorkspace?.path ?? '.'

  // ── Draft / UI store ──────────────────────────────────────────────────────
  const draft = useUIStore((s) => s.drafts[conversationId] ?? '')
  const setDraft = useUIStore((s) => s.setDraft)
  const clearDraft = useUIStore((s) => s.clearDraft)
  const isRunning = useUIStore((s) => s.agentRunning[conversationId] ?? false)
  const [content, setContent] = useState(draft)

  const sendMutation = useSendMessage(conversationId)
  const shouldReduceMotion = useReducedMotion()

  // ── Context injection state ───────────────────────────────────────────────
  const [triggerState, setTriggerState] = useState<TriggerState | null>(null)
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null)

  // File picker
  const [currentPath, setCurrentPath] = useState<string>(workspaceRoot)
  const [fileItems, setFileItems] = useState<FileEntry[]>([])
  const [fileLoading, setFileLoading] = useState(false)
  const [folderCounts, setFolderCounts] = useState<FolderCounts>({ shallow: 0, deep: 0 })

  // Skill picker — reuse existing hook
  const { data: skillData = [], isLoading: skillsLoading } = useRegistrySkills()

  // Security dialog
  const [skillForReview, setSkillForReview] = useState<RegistrySkillData | null>(null)

  // Context store actions
  const addFile = useChatContextStore((s) => s.addFile)
  const addFolder = useChatContextStore((s) => s.addFolder)
  const addSkill = useChatContextStore((s) => s.addSkill)
  const clearItems = useChatContextStore((s) => s.clearItems)

  // ── Draft sync & auto-grow ────────────────────────────────────────────────

  useEffect(() => {
    setContent(draft)
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => setDraft(conversationId, content), 500)
    return () => clearTimeout(t)
  }, [content, conversationId, setDraft])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [content])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [conversationId])

  // ── Picker position ───────────────────────────────────────────────────────

  const calculatePickerPosition = useCallback(() => {
    if (!textareaRef.current) return null
    const rect = textareaRef.current.getBoundingClientRect()
    return {
      top: rect.top - 268 + window.scrollY,
      left: rect.left + 10
    }
  }, [])

  // ── Picker close ──────────────────────────────────────────────────────────

  const closePicker = useCallback(() => {
    setTriggerState(null)
    setPickerPosition(null)
  }, [])

  // ── Clear trigger text from textarea ─────────────────────────────────────

  const clearTriggerText = useCallback(
    (trigger: TriggerState) => {
      // Check if the character at trigger.startIndex - 1 is '@' or '#'
      const charBefore = content[trigger.startIndex - 1]
      if (charBefore === '@' || charBefore === '#') {
        const before = content.substring(0, trigger.startIndex - 1)
        const after = content.substring(trigger.startIndex)
        setContent(before + after)
      }
      closePicker()
    },
    [content, closePicker]
  )

  // ── File system ───────────────────────────────────────────────────────────

  const loadDirectory = useCallback(async (path: string) => {
    setFileLoading(true)
    setCurrentPath(path)
    try {
      const res = await commands.listDirectoryContents(path)
      if (res.status === 'ok') {
        setFileItems(res.data as unknown as FileEntry[])
      }
    } catch (err) {
      console.error('Failed to load directory:', err)
    } finally {
      setFileLoading(false)
    }
  }, [])

  const handleFileSelect = useCallback(
    async (file: FileEntry, isDeep?: boolean) => {
      if (!triggerState) return

      if (file.is_dir) {
        if (file.name === '..') {
          // Navigate to parent
          loadDirectory(file.path)
          return
        }
        if (file.name === '.') {
          // Current folder chosen via scope modal
          if (isDeep !== undefined) {
            try {
              const res = await commands.countFolderFiles(file.path)
              if (res.status === 'ok') {
                const counts = res.data as unknown as FolderCounts
                addFolder({
                  id: file.path,
                  name: file.path.split('/').pop() || file.path,
                  path: file.path,
                  scope: isDeep ? 'deep' : 'shallow',
                  fileCount: isDeep ? counts.deep : counts.shallow
                })
              }
            } catch (err) {
              console.error('count_folder_files error:', err)
            }
            clearTriggerText(triggerState)
            closePicker()
          }
          return
        }
        // Regular folder: navigate into it and also pre-fetch counts for scope modal
        loadDirectory(file.path)
        const countsRes = await commands.countFolderFiles(file.path)
        if (countsRes.status === 'ok') {
          setFolderCounts(countsRes.data as unknown as FolderCounts)
        }
        return
      }

      // Plain file selected
      addFile({ id: file.path, name: file.name, path: file.path, size: file.size })
      clearTriggerText(triggerState)
      closePicker()
    },
    [triggerState, loadDirectory, addFile, addFolder, clearTriggerText, closePicker]
  )

  // ── Skill selection ───────────────────────────────────────────────────────

  const confirmAddSkill = useCallback(
    (skill: RegistrySkillData) => {
      addSkill(skill)
      if (triggerState) clearTriggerText(triggerState)
      setSkillForReview(null)
      closePicker()
    },
    [addSkill, triggerState, clearTriggerText, closePicker]
  )

  const handleSkillSelect = useCallback(
    (skill: RegistrySkillData) => {
      const rawWarnings = skill.lintWarnings as unknown as Array<{
        rule_id?: string
        severity?: string
      }>
      const hasDanger =
        skill.securityScore < 2 ||
        rawWarnings.some((w) => w.severity === 'error' || (w.rule_id ?? '').includes('sec-'))

      if (hasDanger) {
        setSkillForReview(skill)
        closePicker()
      } else {
        confirmAddSkill(skill)
      }
    },
    [confirmAddSkill, closePicker]
  )

  // ── Keyboard handler ──────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      closePicker()
      return
    }

    if (e.key === 'Enter' && !e.shiftKey && !isComposing && !triggerState) {
      e.preventDefault()
      submit()
      return
    }

    // Detect trigger characters
    if (e.key === '@' || e.key === '#') {
      const cursorPos = e.currentTarget.selectionStart ?? 0
      const type = e.key === '@' ? 'skill' : 'file'
      setTriggerState({ type, query: '', startIndex: cursorPos + 1 })
      setPickerPosition(calculatePickerPosition())
      if (type === 'file') {
        loadDirectory(workspaceRoot)
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setContent(value)

    if (!triggerState) return

    const cursorPos = e.target.selectionStart ?? 0
    if (cursorPos < triggerState.startIndex) {
      // Trigger char was deleted
      closePicker()
    } else {
      const query = value.substring(triggerState.startIndex, cursorPos)
      setTriggerState((prev) => (prev ? { ...prev, query } : null))
      if (!pickerPosition) setPickerPosition(calculatePickerPosition())
    }
  }

  // ── Native file picker (Paperclip button) ─────────────────────────────────

  const pickFiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: 'All Files', extensions: ['*'] }]
    })
    if (!selected) return
    const paths = Array.isArray(selected) ? selected : [selected]
    const newFiles = paths.map((p) => ({
      path: p,
      name: p.split('/').pop() || p
    }))
    setSelectedFiles((prev) => [...prev, ...newFiles])
  }, [])

  const removeFile = useCallback((pathToRemove: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.path !== pathToRemove))
  }, [])

  // ── Manual trigger buttons ────────────────────────────────────────────────

  const triggerFilePicker = () => {
    setCurrentPath(workspaceRoot)
    setTriggerState({ type: 'file', query: '', startIndex: content.length + 1 })
    setPickerPosition(calculatePickerPosition())
    loadDirectory(workspaceRoot)
    textareaRef.current?.focus()
  }

  const triggerSkillPicker = () => {
    setTriggerState({ type: 'skill', query: '', startIndex: content.length + 1 })
    setPickerPosition(calculatePickerPosition())
    textareaRef.current?.focus()
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    let finalContent = content.trim()

    // Append legacy file tags for native-picker attachments
    for (const file of selectedFiles) {
      finalContent += `\n<file path="${file.path}" />`
    }

    if (!finalContent.trim() || isComposing || isRunning) return

    setIsSending(true)
    setContent('')
    setSelectedFiles([])
    clearDraft(conversationId)
    clearItems()

    try {
      await sendMutation.mutateAsync(finalContent)
    } catch (err) {
      setContent(finalContent)
      console.error('Failed to send message:', err)
    } finally {
      setIsSending(false)
    }
  }, [
    content,
    selectedFiles,
    isComposing,
    isRunning,
    conversationId,
    clearDraft,
    clearItems,
    sendMutation
  ])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-3 space-y-2">
      {/* Legacy native-picker file chips */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedFiles.map((file) => (
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

      <div
        className={cn(
          'relative rounded-xl border border-input bg-background shadow-sm',
          'focus-within:ring-2 focus-within:ring-ring/50'
        )}
      >
        {/* Context chips (skills / files / folders from picker) */}
        <AttachedItemsList />

        <div className="flex items-end gap-2 px-3 py-2">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={
              isRunning
                ? 'Agent is running…'
                : 'Type a message… (@ for skills · # for files)'
            }
            disabled={isRunning}
            className={cn(
              'flex-1 min-h-[36px] max-h-[200px] resize-none border-0 shadow-none bg-transparent',
              'focus-visible:ring-0 text-sm leading-6 py-2 px-0 overflow-y-hidden'
            )}
            rows={1}
          />

          <Button
            size="icon-sm"
            className="shrink-0 mb-0.5"
            onClick={submit}
            disabled={
              (!content.trim() && selectedFiles.length === 0 && !isRunning) ||
              sendMutation.isPending ||
              isSending
            }
            aria-label={isRunning ? 'Stop' : 'Send'}
          >
            <AnimatePresence mode="wait">
              {isSending ? (
                <motion.div
                  key="sending"
                  initial={shouldReduceMotion ? {} : { rotate: 0 }}
                  animate={shouldReduceMotion ? {} : { rotate: 360 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.5, repeat: Infinity, ease: 'linear' }
                  }
                >
                  <Send className="size-3.5" />
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={shouldReduceMotion ? {} : { scale: 0.8 }}
                  animate={shouldReduceMotion ? {} : { scale: 1 }}
                  exit={shouldReduceMotion ? {} : { scale: 0.8 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
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
      </div>

      {/* Input toolbar */}
      <div className="flex items-center gap-0.5 text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={triggerSkillPicker}
          title="Attach skill (@)"
        >
          <AtSign className="size-3" />
          Skill
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={triggerFilePicker}
          title="Attach file (#)"
        >
          <Hash className="size-3" />
          File
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={pickFiles}
          title="Attach via file dialog"
        >
          <Paperclip className="size-3" />
          Attach
        </Button>
        <span className="ml-auto text-xs opacity-50 pr-1">
          ↵ send · ⇧↵ newline
        </span>
      </div>

      {/* File mention picker (portal) */}
      {triggerState?.type === 'file' && (
        <FileMentionPicker
          open
          query={triggerState.query}
          position={pickerPosition}
          items={fileItems}
          loading={fileLoading}
          currentFolderCounts={folderCounts}
          onSelect={handleFileSelect}
          onClose={closePicker}
          onQueryChange={(q) =>
            setTriggerState((prev) => (prev ? { ...prev, query: q } : null))
          }
        />
      )}

      {/* Skill command palette (portal) */}
      {triggerState?.type === 'skill' && (
        <ChatCommandPalette
          type="skill"
          query={triggerState.query}
          items={skillData}
          loading={skillsLoading}
          position={pickerPosition}
          onSelect={handleSkillSelect}
          onClose={closePicker}
        />
      )}

      {/* Security warning dialog */}
      {skillForReview && (
        <SecurityWarningDialog
          skill={skillForReview}
          onConfirm={() => confirmAddSkill(skillForReview)}
          onCancel={() => setSkillForReview(null)}
        />
      )}
    </div>
  )
}
