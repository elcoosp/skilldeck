/**
 * Message input — auto-growing textarea with draft persistence, slash commands,
 * skill mention (@), file reference (#) entry points, and file attachments.
 *
 * Context injection: type `@` to search skills, `#` to browse the file system.
 * Selected items appear as chips above the textarea and are cleared on send.
 *
 * Queued messages are now persisted in the database and managed via React Query.
 */

import { open } from '@tauri-apps/plugin-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AtSign, Hash, Paperclip, Send, Timer, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { AttachedItemsList } from '@/components/chat/attached-items-list'
import { ChatCommandPalette } from '@/components/chat/chat-command-palette'
import { FileMentionPicker } from '@/components/chat/file-mention-picker'
import { SecurityWarningDialog } from '@/components/chat/security-warning-dialog'
import { QueueHeader } from '@/components/conversation/queue/queue-header'
import { QueueList } from '@/components/conversation/queue/queue-list'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCreateConversation } from '@/hooks/use-conversations'
import { useSendMessage } from '@/hooks/use-messages'
import { useProfiles } from '@/hooks/use-profiles'
import {
  useAddQueuedMessage,
  useQueuedMessages
} from '@/hooks/use-queued-messages'
import { useUnifiedSkills } from '@/hooks/use-unified-skills'
import { useWorkspaces } from '@/hooks/use-workspaces'
import type { RegistrySkillData } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useChatContextStore } from '@/store/chat-context-store'
import { useQueueStore } from '@/store/queue'
import { useUIStore } from '@/store/ui'
import type {
  FileEntry,
  FolderCounts,
  TriggerState
} from '@/types/chat-context'
import type { UnifiedSkill } from '@/types/skills'
import type { ContextItem } from '@/lib/bindings'

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
  const activeWorkspace = workspaces?.find((w) => w.id === activeWorkspaceId)
  const workspaceRoot = activeWorkspace?.path ?? undefined

  // ── Profiles (for auto‑create) ──────────────────────────────────────────
  const { data: profiles = [] } = useProfiles()
  const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0]

  // ── Draft / UI store ──────────────────────────────────────────────────────
  const draft = useUIStore((s) => s.drafts[conversationId] ?? '')
  const setDraft = useUIStore((s) => s.setDraft)
  const clearDraft = useUIStore((s) => s.clearDraft)
  const isRunning = useUIStore((s) => s.agentRunning[conversationId] ?? false)
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)

  const [content, setContent] = useState(draft)

  const sendMutation = useSendMessage(conversationId)
  const createConversation = useCreateConversation(defaultProfile?.id)

  const shouldReduceMotion = useReducedMotion()

  // ── Queue ─────────────────────────────────────────────────────────────────
  const { data: queuedMessages = [] } = useQueuedMessages(conversationId)
  const addQueuedMessage = useAddQueuedMessage(conversationId)
  const queueExpanded = useQueueStore(
    (s) => s.expanded[conversationId] ?? false
  )

  // ── Unified skills for @ picker ─────────────────────────────────────────
  const { unifiedSkills = [], isLoading: skillsLoading } = useUnifiedSkills()

  // ── Context injection state ───────────────────────────────────────────────
  const [triggerState, setTriggerState] = useState<TriggerState | null>(null)
  const [pickerPosition, setPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  // File picker
  const [fileItems, setFileItems] = useState<FileEntry[]>([])
  const [fileLoading, setFileLoading] = useState(false)
  const [folderCounts, setFolderCounts] = useState<FolderCounts>({
    shallow: 0,
    deep: 0
  })

  // Security dialog
  const [skillForReview, setSkillForReview] =
    useState<RegistrySkillData | null>(null)

  // Context store actions
  const items = useChatContextStore((s) => s.items)
  const addFile = useChatContextStore((s) => s.addFile)
  const addFolder = useChatContextStore((s) => s.addFolder)
  const addSkill = useChatContextStore((s) => s.addSkill)
  const clearItems = useChatContextStore((s) => s.clearItems)

  // ── Draft sync & auto-grow ────────────────────────────────────────────────

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only sync on conversation change
  useEffect(() => {
    setContent(draft)
  }, [conversationId])

  useEffect(() => {
    const t = setTimeout(() => setDraft(conversationId, content), 500)
    return () => clearTimeout(t)
  }, [content, conversationId, setDraft])

  // biome-ignore lint/correctness/useExhaustiveDependencies: effect depends on content indirectly
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [content])

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus on conversation change
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
      addFile({
        id: file.path,
        name: file.name,
        path: file.path,
        size: file.size ?? undefined
      })
      clearTriggerText(triggerState)
      closePicker()
    },
    [
      triggerState,
      loadDirectory,
      addFile,
      addFolder,
      clearTriggerText,
      closePicker
    ]
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
    (skill: UnifiedSkill) => {
      if (skill.registryData) {
        // Registry skill
        const rawWarnings = skill.registryData.lintWarnings ?? []
        const hasDanger =
          skill.registryData.securityScore < 2 ||
          rawWarnings.some(
            (w: any) =>
              w.severity === 'error' || (w.rule_id ?? '').includes('sec-')
          )

        if (hasDanger) {
          setSkillForReview(skill.registryData)
          closePicker()
        } else {
          confirmAddSkill(skill.registryData)
        }
      } else if (skill.localData) {
        // Local skill – construct minimal RegistrySkillData
        const localSkillData: RegistrySkillData = {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          source: 'local',
          sourceUrl: null,
          version: null,
          author: null,
          license: null,
          tags: [],
          category: null,
          lintWarnings: [],
          securityScore: 5,
          qualityScore: 5,
          metadataSource: 'local',
          content: '',
          createdAt: '',
          updatedAt: ''
        }
        confirmAddSkill(localSkillData)
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
      if (isRunning) {
        // Queue the current draft instead of sending
        if (content.trim()) {
          // ✅ FIXED: pass object with content
          addQueuedMessage.mutate({ content })
          setContent('')
        }
      } else {
        submit()
      }
      return
    }

    // Detect trigger characters
    if (e.key === '@' || e.key === '#') {
      const cursorPos = e.currentTarget.selectionStart ?? 0
      const type = e.key === '@' ? 'skill' : 'file'
      setTriggerState({ type, query: '', startIndex: cursorPos + 1 })
      setPickerPosition(calculatePickerPosition())
      if (type === 'file' && activeWorkspace) {
        loadDirectory(workspaceRoot!)
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

  const triggerFilePicker = useCallback(() => {
    setTriggerState({ type: 'file', query: '', startIndex: content.length + 1 })
    setPickerPosition(calculatePickerPosition())
    if (activeWorkspace) {
      loadDirectory(workspaceRoot!)
    }
    textareaRef.current?.focus()
  }, [
    content,
    activeWorkspace,
    workspaceRoot,
    loadDirectory,
    calculatePickerPosition
  ])

  const triggerSkillPicker = useCallback(() => {
    setTriggerState({
      type: 'skill',
      query: '',
      startIndex: content.length + 1
    })
    setPickerPosition(calculatePickerPosition())
    textareaRef.current?.focus()
  }, [content, calculatePickerPosition])

  // ── Submit / Queue ────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    let finalContent = content.trim()

    // Append legacy file tags for native-picker attachments
    for (const file of selectedFiles) {
      finalContent += `\n<file path="${file.path}" />`
    }

    if (!finalContent.trim() || isComposing || isRunning) return

    // Auto‑create conversation if none is active
    let finalConversationId = conversationId
    if (!finalConversationId) {
      const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0]
      if (!defaultProfile) {
        toast.error('No profile available to create conversation')
        return
      }
      try {
        finalConversationId = await createConversation.mutateAsync({})
        setActiveConversation(finalConversationId)
      } catch (err) {
        toast.error(`Failed to create conversation: ${err}`)
        return
      }
    }

    // Build metadata-only context items from the store, converting types to match ContextItem
    const metadataItems: ContextItem[] = items.map((item) => {
      if (item.type === 'file') {
        return {
          type: 'file',
          path: item.data.path,
          name: item.data.name,
          size: item.data.size ? String(item.data.size) : null, // convert to string | null
        }
      }
      if (item.type === 'folder') {
        return {
          type: 'folder',
          path: item.data.path,
          name: item.data.name,
          scope: item.data.scope,
          file_count: String(item.data.fileCount), // convert to string
        }
      }
      // skill
      return {
        type: 'skill',
        name: item.data.name,
      }
    })

    setIsSending(true)
    setContent('')
    setSelectedFiles([])
    clearDraft(finalConversationId)
    clearItems()

    try {
      // Pass only content and contextItems; conversationId is already known by the mutation
      await sendMutation.mutateAsync({
        content: finalContent,
        contextItems: metadataItems.length > 0 ? metadataItems : undefined,
      })
    } catch (err) {
      toast.error(`Failed to send message: ${err}`)
      setContent(finalContent) // restore draft
    } finally {
      setIsSending(false)
    }
  }, [
    content,
    selectedFiles,
    isComposing,
    isRunning,
    conversationId,
    profiles,
    createConversation,
    setActiveConversation,
    clearDraft,
    clearItems,
    items,
    sendMutation,
  ])

  // ── Render ────────────────────────────────────────────────────────────────
  console.log({ queuedMessages })
  return (
    <div className="p-3 space-y-2">
      {/* Queue header – always visible when there are messages */}
      {queuedMessages.length > 0 && (
        <div className="space-y-1">
          <QueueHeader
            conversationId={conversationId}
            messages={queuedMessages}
          />
          {queueExpanded && <QueueList conversationId={conversationId} />}
        </div>
      )}

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
                type="button"
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

        <div className="flex items-center gap-2 px-3 py-2">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={
              isRunning
                ? 'Agent is running… (type to queue)'
                : 'Type a message… (@ for skills · # for files)'
            }
            disabled={false}
            className={cn(
              'flex-1 min-h-[36px] max-h-[200px] resize-none border-0 shadow-none bg-transparent',
              'focus-visible:ring-0 text-sm leading-6 py-2 px-0 overflow-y-hidden'
            )}
            rows={1}
          />

          <Button
            size="icon-sm"
            className="shrink-0 mb-0.5"
            onClick={
              isRunning ? () => addQueuedMessage.mutate({ content }) : submit
            }
            disabled={
              (!content.trim() && selectedFiles.length === 0) ||
              sendMutation.isPending ||
              isSending ||
              (isRunning && addQueuedMessage.isPending)
            }
            aria-label={isRunning ? 'Queue message' : 'Send'}
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
                  transition={
                    shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }
                  }
                >
                  {isRunning ? (
                    <Timer className="size-3.5" />
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
        >
          <AtSign className="size-3" />
          Skill
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-block">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={triggerFilePicker}
                disabled={!activeWorkspace}
              >
                <Hash className="size-3" />
                File
              </Button>
            </span>
          </TooltipTrigger>
          {!activeWorkspace && (
            <TooltipContent side="top">
              <p>Open a workspace first to browse files.</p>
            </TooltipContent>
          )}
        </Tooltip>

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
          ↵ {isRunning ? 'queue' : 'send'} · ⇧↵ newline
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
          workspaceRoot={workspaceRoot}
        />
      )}

      {/* Skill command palette (portal) */}
      {triggerState?.type === 'skill' && (
        <ChatCommandPalette
          type="skill"
          query={triggerState.query}
          items={unifiedSkills}
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
