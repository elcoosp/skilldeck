// src/components/conversation/message-input.tsx
// Full file with concierge-ui additions (suggested prompts, auto-approve toggle, thinking mode)

import { open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  AtSign,
  Globe,
  Hash,
  Paperclip,
  Send,
  Square,
  Timer,
  Shield,
  ShieldCheck,
  BrainCircuit,
  DollarSign
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { toast } from 'sonner'
import { useDebouncedCallback } from 'use-debounce'
import { AttachedItemsList } from '@/components/chat/attached-items-list'
import { ChatCommandPalette } from '@/components/chat/chat-command-palette'
import { ContextChip } from '@/components/chat/context-chip'
import { FileMentionPicker } from '@/components/chat/file-mention-picker'
import { SecurityWarningDialog } from '@/components/chat/security-warning-dialog'
import { QueueHeader } from '@/components/conversation/queue/queue-header'
import { QueueList } from '@/components/conversation/queue/queue-list'
import { SuggestedPrompts } from '@/components/conversation/suggested-prompts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useCreateConversation } from '@/hooks/use-conversations'
import { useMessages } from '@/hooks/use-messages'
import { useSendMessage } from '@/hooks/use-messages'
import { useProfiles } from '@/hooks/use-profiles'
import { useProviderReady } from '@/hooks/use-provider-ready'
import {
  useAddQueuedMessage,
  useQueuedMessages
} from '@/hooks/use-queued-messages'
import { useUnifiedSkills } from '@/hooks/use-unified-skills'
import { useWorkspaces } from '@/hooks/use-workspaces'
import type { ContextItem, RegistrySkillData } from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import type { UUID } from '@/lib/types'
import { extractUrls } from '@/lib/url-detection'
import { cn } from '@/lib/utils'
import { useChatContextStore } from '@/store/chat-context-store'
import { useConversationStore } from '@/store/conversation'
import { useQueueStore } from '@/store/queue'
import { useSettingsStore } from '@/store/settings'
import { useToolApprovalStore } from '@/store/tool-approvals'
import { useUIEphemeralStore } from '@/store/ui-ephemeral'
import { useWorkspaceStore } from '@/store/workspace'
import type {
  FileEntry,
  FolderCounts,
  TriggerState
} from '@/types/chat-context'
import type { UnifiedSkill } from '@/types/skills'
import { playSound } from '@/lib/audio'

interface MessageInputProps {
  conversationId: UUID
  workspaceRoot?: string
  onRequestScrollToBottom?: () => void
}

interface FileChip {
  path: string
  name: string
}

type UploadStatus = 'pending' | 'success' | 'error'
type UploadStatusMap = Map<string, { status: UploadStatus }>

const MAX_HEIGHT = 192 // 12 * 16px = 192px

export function MessageInput({
  conversationId,
  workspaceRoot,
  onRequestScrollToBottom
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileChip[]>([])
  const [processingFiles, setProcessingFiles] = useState<UploadStatusMap>(
    new Map()
  )
  const [isSending, setIsSending] = useState(false)
  const [contentHeight, setContentHeight] = useState(36)

  // ── Workspace context ───────────────────────────────────────────────────
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const { data: workspaces } = useWorkspaces()
  const activeWorkspace = workspaces?.find((w) => w.id === activeWorkspaceId)
  const effectiveWorkspaceRoot = workspaceRoot ?? activeWorkspace?.path

  // ── Profiles & provider readiness ──────────────────────────────────────────
  const { data: profiles } = useProfiles()
  const activeProfile = profiles?.find((p) => p.is_default) ?? profiles?.[0]
  const { data: readiness, isLoading: readinessLoading } = useProviderReady(
    activeProfile?.id
  )
  const defaultProfile = profiles?.find((p) => p.is_default) ?? profiles?.[0]

  // ── Draft / UI store ──────────────────────────────────────────────────────
  const draft = useUIEphemeralStore((s) => s.drafts[conversationId] ?? '')
  const setDraft = useUIEphemeralStore((s) => s.setDraft)
  const clearDraft = useUIEphemeralStore((s) => s.clearDraft)
  const isRunning = useUIEphemeralStore(
    (s) => s.agentRunning[conversationId] ?? false
  )
  const setActiveConversation = useConversationStore(
    (s) => s.setActiveConversation
  )
  const setAgentRunning = useUIEphemeralStore((s) => s.setAgentRunning)

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
  const itemsMap = useChatContextStore((s) => s.items)
  const addFile = useChatContextStore((s) => s.addFile)
  const addFolder = useChatContextStore((s) => s.addFolder)
  const addSkill = useChatContextStore((s) => s.addSkill)
  const clearItems = useChatContextStore((s) => s.clearItems)

  const currentItems = itemsMap[conversationId] ?? []

  // ─── URL detection ───────────────────────────────────────────────────────
  const [detectedUrls, setDetectedUrls] = useState<string[]>([])

  useEffect(() => {
    setDetectedUrls(extractUrls(content))
  }, [content])

  // ─── Height calculation for textarea ─────────────────────────────────────
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    // Force reflow by setting to 0px
    el.style.height = '0px'
    const newHeight = Math.min(el.scrollHeight, MAX_HEIGHT)
    el.style.height = `${newHeight}px`
    setContentHeight(newHeight)
  }) // No dependency array – runs after every render, which is correct

  // ─── Draft sync & auto-grow ────────────────────────────────────────────────
  useEffect(() => {
    setContent(draft)
  }, [draft])

  useEffect(() => {
    const t = setTimeout(() => setDraft(conversationId, content), 500)
    return () => clearTimeout(t)
  }, [content, conversationId, setDraft])

  // biome-ignore lint/correctness/useExhaustiveDependencies: effect depends on content indirectly
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [content])

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus on conversation change
  useEffect(() => {
    textareaRef.current?.focus()
  }, [conversationId])

  // ─── Draft persistence: load from DB on mount ────────────────────────────────
  useEffect(() => {
    if (!conversationId) return
    commands
      .getConversationDraft(conversationId)
      .then((res) => {
        if (res.status === 'ok' && res.data) {
          const [text, items] = res.data
          setContent(text)
          items.forEach((item: any) => {
            if (item.type === 'file') addFile(conversationId, item.data)
            else if (item.type === 'folder')
              addFolder(conversationId, item.data)
            else if (item.type === 'skill') addSkill(conversationId, item.data)
          })
        }
      })
      .catch((err) => console.error('Failed to load draft:', err))
  }, [conversationId, addFile, addFolder, addSkill])

  // ─── Debounced save draft to DB ─────────────────────────────────────────────
  const debouncedSaveDraft = useDebouncedCallback(
    (text: string, items: any[]) => {
      if (!conversationId) return
      const itemsJson = items.map((item) => item.data)
      commands
        .upsertConversationDraft(conversationId, text, itemsJson)
        .catch((err) => {
          console.error('Failed to save draft:', err)
        })
    },
    500
  )

  // Save on content or items change
  useEffect(() => {
    if (!conversationId) return
    const items = itemsMap[conversationId] ?? []
    debouncedSaveDraft(content, items)
  }, [content, conversationId, itemsMap, debouncedSaveDraft])

  // ─── Picker close & refocus ─────────────────────────────────────────────

  const closePicker = useCallback(() => {
    setTriggerState(null)
    textareaRef.current?.focus()
  }, [])

  // ─── Clear trigger text from textarea ─────────────────────────────────────

  const clearTriggerText = useCallback(
    (trigger: TriggerState) => {
      const charBefore = content[trigger.startIndex - 1]
      if (charBefore === '$' || charBefore === '#') {
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
          loadDirectory(file.path)
          return
        }
        if (file.name === '.') {
          if (isDeep !== undefined) {
            try {
              const res = await commands.countFolderFiles(file.path)
              if (res.status === 'ok') {
                const counts = res.data as unknown as FolderCounts
                addFolder(conversationId, {
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
        loadDirectory(file.path)
        const countsRes = await commands.countFolderFiles(file.path)
        if (countsRes.status === 'ok') {
          setFolderCounts(countsRes.data as unknown as FolderCounts)
        }
        return
      }

      addFile(conversationId, {
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
      conversationId,
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
      addSkill(conversationId, skill)
      if (triggerState) clearTriggerText(triggerState)
      setSkillForReview(null)
      closePicker()
    },
    [addSkill, conversationId, triggerState, clearTriggerText, closePicker]
  )

  const handleSkillSelect = useCallback(
    (skill: UnifiedSkill) => {
      if (skill.registryData) {
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
        if (content.trim()) {
          addQueuedMessage.mutate({ content })
          setContent('')
        }
      } else {
        submit()
      }
      return
    }

    if (e.key === '$' || e.key === '#') {
      const cursorPos = e.currentTarget.selectionStart ?? 0
      const type = e.key === '$' ? 'skill' : 'file'
      setTriggerState({ type, query: '', startIndex: cursorPos + 1 })
      if (type === 'file' && effectiveWorkspaceRoot) {
        loadDirectory(effectiveWorkspaceRoot)
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setContent(value)

    if (!triggerState) return

    const cursorPos = e.target.selectionStart ?? 0
    if (cursorPos < triggerState.startIndex) {
      closePicker()
    } else {
      const query = value.substring(triggerState.startIndex, cursorPos)
      setTriggerState((prev) => (prev ? { ...prev, query } : null))
    }
  }

  // ── Native file picker (Paperclip button) with upload simulation ─────────

  const pickFiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: 'All Files', extensions: ['*'] }]
    })
    if (!selected) return
    const paths = Array.isArray(selected) ? selected : [selected]

    // Add files with pending status and simulate processing
    const newFiles = paths.map((p) => ({
      path: p,
      name: p.split('/').pop() || p
    }))

    setSelectedFiles((prev) => [...prev, ...newFiles])

    // Simulate processing for each file
    for (const file of newFiles) {
      setProcessingFiles((prev) => {
        const next = new Map(prev)
        next.set(file.path, { status: 'pending' })
        return next
      })

      // Simulate async processing (e.g., reading file, uploading)
      setTimeout(() => {
        setProcessingFiles((prev) => {
          const next = new Map(prev)
          next.set(file.path, { status: 'success' })
          return next
        })
        // Optionally remove success status after a delay
        setTimeout(() => {
          setProcessingFiles((prev) => {
            const next = new Map(prev)
            next.delete(file.path)
            return next
          })
        }, 2000)
      }, 1500)
    }
  }, [])

  const removeFile = useCallback((pathToRemove: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.path !== pathToRemove))
    setProcessingFiles((prev) => {
      const next = new Map(prev)
      next.delete(pathToRemove)
      return next
    })
  }, [])

  // ── Manual trigger buttons ────────────────────────────────────────────────

  const triggerFilePicker = useCallback(() => {
    setTriggerState({ type: 'file', query: '', startIndex: content.length + 1 })
    if (effectiveWorkspaceRoot) {
      loadDirectory(effectiveWorkspaceRoot)
    }
    textareaRef.current?.focus()
  }, [content, effectiveWorkspaceRoot, loadDirectory])

  const triggerSkillPicker = useCallback(() => {
    setTriggerState({
      type: 'skill',
      query: '',
      startIndex: content.length + 1
    })
    textareaRef.current?.focus()
  }, [content])

  // ── Stop agent ───────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    try {
      await commands.cancelAgent(conversationId)
      setAgentRunning(conversationId, false)
    } catch (err) {
      toast.error(`Failed to stop agent: ${err}`)
    }
  }, [conversationId, setAgentRunning])

  // ── Auto-approve toggle (F17) ────────────────────────────────────────────
  const toolApprovals = useSettingsStore((s) => s.toolApprovals)
  const setToolApprovals = useSettingsStore((s) => s.setToolApprovals)
  const hasAnyApproval = toolApprovals.autoApproveReads || toolApprovals.autoApproveWrites || toolApprovals.autoApproveShell || toolApprovals.autoApproveHttpRequests

  // ── Thinking mode toggle (F02) ────────────────────────────────────────────
  const thinkingEnabled = useSettingsStore((s) => s.thinkingEnabled)
  const setThinkingEnabled = useSettingsStore((s) => s.setThinkingEnabled)

  // ── Submit / Queue ────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    // Provider readiness guard
    if (readiness?.status.status !== 'ready') {
      toast.error(readiness?.status.reason ?? 'Provider not ready')
      return
    }

    let finalContent = content.trim()

    for (const file of selectedFiles) {
      finalContent += `\n<file path="${file.path}" />`
    }

    if (!finalContent.trim() || isComposing || isRunning) return

    let finalConversationId = conversationId
    if (!finalConversationId) {
      const defaultProfile =
        profiles?.find((p) => p.is_default) ?? profiles?.[0]
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

    const metadataItems: ContextItem[] = currentItems.map((item) => {
      if (item.type === 'file') {
        return {
          type: 'file',
          path: item.data.path,
          name: item.data.name,
          size: item.data.size ? String(item.data.size) : null
        }
      }
      if (item.type === 'folder') {
        return {
          type: 'folder',
          path: item.data.path,
          name: item.data.name,
          scope: item.data.scope,
          file_count: String(item.data.fileCount)
        }
      }
      return {
        type: 'skill',
        name: item.data.name
      }
    })

    setIsSending(true)
    setContent('')
    setSelectedFiles([])
    setProcessingFiles(new Map())
    clearDraft(finalConversationId)
    clearItems(finalConversationId)

    try {
      await sendMutation.mutateAsync({
        content: finalContent,
        contextItems: metadataItems.length > 0 ? metadataItems : undefined,
        thinking: thinkingEnabled
      })
      playSound('messageSent')
      onRequestScrollToBottom?.()
    } catch (err) {
      toast.error(`Failed to send message: ${err}`)
      setContent(finalContent)
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
    currentItems,
    sendMutation,
    onRequestScrollToBottom,
    readiness,
    thinkingEnabled
  ])

  // Get messages count for suggested prompts
  const messages = useMessages(conversationId)
  const hasMessages = (messages.data?.length ?? 0) > 0

  return (
    <div className="p-3 space-y-2">
      {queuedMessages.length > 0 && (
        <div className="space-y-1">
          <QueueHeader
            conversationId={conversationId}
            messages={queuedMessages}
          />
          {queueExpanded && <QueueList conversationId={conversationId} />}
        </div>
      )}

      {/* Provider readiness banner */}
      {!readinessLoading && readiness?.status.status === 'not_ready' && (
        <div className="mb-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-amber-800 dark:text-amber-300">
              Provider Not Ready
            </span>
          </div>
          <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
            {readiness.status.reason} {readiness.status.fix_action}
          </p>
        </div>
      )}

      {/* Selected files with animated chips */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-wrap gap-1.5"
          >
            {selectedFiles.map((file) => {
              const statusObj = processingFiles.get(file.path)
              const status = statusObj?.status
              return (
                <motion.div
                  key={file.path}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <ContextChip
                    item={{
                      type: 'file',
                      data: {
                        id: file.path,
                        name: file.name,
                        path: file.path,
                        size: undefined
                      }
                    }}
                    onRemove={() => removeFile(file.path)}
                    isLoading={status === 'pending'}
                  />
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={containerRef}
        className={cn(
          'relative rounded-xl border border-input bg-background shadow-sm',
          'focus-within:ring-2 focus-within:ring-ring/50'
        )}
      >
        {/* Skill picker – rendered inline, anchored above the input */}
        {triggerState?.type === 'skill' && (
          <ChatCommandPalette
            type="skill"
            query={triggerState.query}
            items={unifiedSkills}
            loading={skillsLoading}
            onSelect={handleSkillSelect}
            onClose={closePicker}
            onQueryChange={(q) =>
              setTriggerState((prev) => (prev ? { ...prev, query: q } : null))
            }
          />
        )}

        {/* File picker – rendered inline, anchored above the input */}
        {triggerState?.type === 'file' && (
          <FileMentionPicker
            open
            query={triggerState.query}
            items={fileItems}
            loading={fileLoading}
            currentFolderCounts={folderCounts}
            onSelect={handleFileSelect}
            onClose={closePicker}
            onQueryChange={(q) =>
              setTriggerState((prev) => (prev ? { ...prev, query: q } : null))
            }
            workspaceRoot={effectiveWorkspaceRoot}
            uploadingFiles={processingFiles}
          />
        )}

        <AttachedItemsList />

        {/* Suggested prompts (F03) */}
        <SuggestedPrompts
          conversationId={conversationId}
          hasMessages={hasMessages}
          onSelect={(prompt) => {
            setContent(prompt)
            textareaRef.current?.focus()
          }}
        />

        {/* URL chips */}
        {detectedUrls.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1 pb-1">
            {detectedUrls.map((url) => (
              <TooltipProvider key={url}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => openUrl(url)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-primary hover:underline cursor-pointer"
                    >
                      <Globe className="size-3" />
                      <span className="truncate max-w-[200px]">{url}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Open {url}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2">
          <motion.div
            animate={{ height: contentHeight }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
            className="overflow-hidden flex-1"
          >
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
                  : 'Type a message… ($ for skills · # for files)'
              }
              disabled={false}
              className="w-full resize-none border-0 shadow-none bg-transparent focus-visible:ring-0 text-sm leading-6 py-2 px-1.5 overflow-y-auto thin-scrollbar min-h-[36px]"
              style={{ height: '100%' }}
              rows={1}
            />
          </motion.div>

          {/* Button group with animations */}
          <div className="flex items-center gap-2 shrink-0">
            <AnimatePresence mode="wait">
              {!isRunning ? (
                <motion.div
                  key="send"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    size="icon-sm"
                    className="mb-0.5"
                    onClick={submit}
                    disabled={
                      (!content.trim() && selectedFiles.length === 0) ||
                      sendMutation.isPending ||
                      isSending ||
                      readiness?.status.status !== 'ready'
                    }
                    aria-label="Send"
                  >
                    <Send className="size-3.5" />
                  </Button>
                </motion.div>
              ) : (
                <>
                  <motion.div
                    key="stop"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      size="icon-sm"
                      variant="destructive"
                      className="mb-0.5"
                      onClick={handleStop}
                      aria-label="Stop agent"
                    >
                      <Square className="size-3.5" />
                    </Button>
                  </motion.div>
                  <motion.div
                    key="queue"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                  >
                    <Button
                      size="icon-sm"
                      className="mb-0.5"
                      onClick={() => addQueuedMessage.mutate({ content })}
                      disabled={
                        (!content.trim() && selectedFiles.length === 0) ||
                        addQueuedMessage.isPending
                      }
                      aria-label="Queue message"
                    >
                      <Timer className="size-3.5" />
                    </Button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Thinking mode toggle (F02) */}
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', thinkingEnabled && 'text-primary')}
              onClick={() => setThinkingEnabled(!thinkingEnabled)}
              title={thinkingEnabled ? 'Thinking mode ON' : 'Thinking mode OFF'}
            >
              <BrainCircuit className="h-4 w-4" />
            </Button>

            {/* Auto-approve toggle button (F17) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-8 w-8', hasAnyApproval && 'text-green-500')}
                >
                  {hasAnyApproval ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(['autoApproveReads', 'autoApproveWrites', 'autoApproveShell', 'autoApproveHttpRequests'] as const).map((key) => {
                  const label = key.replace('autoApprove', '').replace(/([A-Z])/g, ' $1').trim()
                  return (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => {
                        setToolApprovals({ [key]: !toolApprovals[key] })
                      }}
                    >
                      <span className={toolApprovals[key] ? 'text-green-500' : ''}>{label}</span>
                      <span className="ml-auto">{toolApprovals[key] ? 'ON' : 'OFF'}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0.5 text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={triggerSkillPicker}
        >
          <DollarSign className="size-3" />
          Skill
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={triggerFilePicker}
                disabled={!effectiveWorkspaceRoot}
              >
                <Hash className="size-3" />
                File
              </Button>
            </span>
          </TooltipTrigger>
          {!effectiveWorkspaceRoot && (
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
