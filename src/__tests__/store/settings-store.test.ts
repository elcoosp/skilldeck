// src/__tests__/store/settings-store.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '@/store/settings'

beforeEach(() => {
  useSettingsStore.setState({
    theme: 'system',
    toolApprovals: {
      autoApproveReads: false,
      autoApproveWrites: false,
      autoApproveSelects: false,
      autoApproveMutations: false,
      autoApproveHttpRequests: false,
      autoApproveShell: false
    },
    telemetryEnabled: false,
    notificationsEnabled: true,
    defaultModelId: 'glm-5:cloud',
    defaultProvider: 'ollama',
    language: 'en',
    // new fields
    inputModelId: null,
    thinkingEnabled: false,
    conversationSort: 'updated',
    uiFontSize: 'md',
    preferredEditor: 'system',
    audioEnabled: false,
    audioVolume: 0.5,
    autoCompactionEnabled: false,
    compactionTokenThreshold: 80000
  })
})

// ── Theme ─────────────────────────────────────────────────────────────────────

describe('theme', () => {
  it('defaults to system', () => {
    expect(useSettingsStore.getState().theme).toBe('system')
  })

  it('setTheme updates to light', () => {
    useSettingsStore.getState().setTheme('light')
    expect(useSettingsStore.getState().theme).toBe('light')
  })

  it('setTheme updates to dark', () => {
    useSettingsStore.getState().setTheme('dark')
    expect(useSettingsStore.getState().theme).toBe('dark')
  })

  it('setTheme round-trips back to system', () => {
    useSettingsStore.getState().setTheme('dark')
    useSettingsStore.getState().setTheme('system')
    expect(useSettingsStore.getState().theme).toBe('system')
  })
})

// ── Tool approvals ────────────────────────────────────────────────────────────

describe('toolApprovals', () => {
  it('all approval flags default to false', () => {
    const { toolApprovals } = useSettingsStore.getState()
    for (const [, value] of Object.entries(toolApprovals)) {
      expect(value).toBe(false)
    }
  })

  it('setToolApprovals patches a single field', () => {
    useSettingsStore.getState().setToolApprovals({ autoApproveReads: true })
    expect(useSettingsStore.getState().toolApprovals.autoApproveReads).toBe(
      true
    )
    expect(useSettingsStore.getState().toolApprovals.autoApproveWrites).toBe(
      false
    )
  })

  it('setToolApprovals patches multiple fields at once', () => {
    useSettingsStore.getState().setToolApprovals({
      autoApproveReads: true,
      autoApproveSelects: true
    })
    const { toolApprovals } = useSettingsStore.getState()
    expect(toolApprovals.autoApproveReads).toBe(true)
    expect(toolApprovals.autoApproveSelects).toBe(true)
    expect(toolApprovals.autoApproveWrites).toBe(false)
  })

  it('autoApproveShell stays false by default', () => {
    expect(useSettingsStore.getState().toolApprovals.autoApproveShell).toBe(
      false
    )
  })
})

// ── Other preferences ─────────────────────────────────────────────────────────

describe('preferences', () => {
  it('telemetry defaults to false', () => {
    expect(useSettingsStore.getState().telemetryEnabled).toBe(false)
  })

  it('setTelemetryEnabled updates value', () => {
    useSettingsStore.getState().setTelemetryEnabled(true)
    expect(useSettingsStore.getState().telemetryEnabled).toBe(true)
  })

  it('notifications default to true', () => {
    expect(useSettingsStore.getState().notificationsEnabled).toBe(true)
  })

  it('setNotificationsEnabled can disable notifications', () => {
    useSettingsStore.getState().setNotificationsEnabled(false)
    expect(useSettingsStore.getState().notificationsEnabled).toBe(false)
  })

  it('defaultModelId can be changed', () => {
    useSettingsStore.getState().setDefaultModelId('claude-opus-4-5')
    expect(useSettingsStore.getState().defaultModelId).toBe('claude-opus-4-5')
  })

  it('language can be changed', () => {
    useSettingsStore.getState().setLanguage('fr')
    expect(useSettingsStore.getState().language).toBe('fr')
  })
})

// ── Concierge UI new fields ───────────────────────────────────────────────────

describe('concierge-ui settings', () => {
  it('initializes inputModelId as null', () => {
    expect(useSettingsStore.getState().inputModelId).toBeNull()
  })

  it('setInputModelId updates the model override', () => {
    useSettingsStore.getState().setInputModelId('claude-3-opus')
    expect(useSettingsStore.getState().inputModelId).toBe('claude-3-opus')
  })

  it('initializes thinkingEnabled as false', () => {
    expect(useSettingsStore.getState().thinkingEnabled).toBe(false)
  })

  it('setThinkingEnabled toggles the flag', () => {
    useSettingsStore.getState().setThinkingEnabled(true)
    expect(useSettingsStore.getState().thinkingEnabled).toBe(true)
  })

  it('initializes conversationSort as "updated"', () => {
    expect(useSettingsStore.getState().conversationSort).toBe('updated')
  })

  it('setConversationSort accepts "created"', () => {
    useSettingsStore.getState().setConversationSort('created')
    expect(useSettingsStore.getState().conversationSort).toBe('created')
  })

  it('initializes uiFontSize as "md"', () => {
    expect(useSettingsStore.getState().uiFontSize).toBe('md')
  })

  it('setUiFontSize cycles through sizes', () => {
    useSettingsStore.getState().setUiFontSize('lg')
    expect(useSettingsStore.getState().uiFontSize).toBe('lg')
  })

  it('initializes preferredEditor as "system"', () => {
    expect(useSettingsStore.getState().preferredEditor).toBe('system')
  })

  it('setPreferredEditor accepts known editors', () => {
    useSettingsStore.getState().setPreferredEditor('vscode')
    expect(useSettingsStore.getState().preferredEditor).toBe('vscode')
  })

  it('initializes audioEnabled as false and audioVolume as 0.5', () => {
    const s = useSettingsStore.getState()
    expect(s.audioEnabled).toBe(false)
    expect(s.audioVolume).toBe(0.5)
  })

  it('setAudioEnabled and setAudioVolume update independently', () => {
    useSettingsStore.getState().setAudioEnabled(true)
    useSettingsStore.getState().setAudioVolume(0.8)
    const s = useSettingsStore.getState()
    expect(s.audioEnabled).toBe(true)
    expect(s.audioVolume).toBe(0.8)
  })

  it('initializes autoCompactionEnabled as false with threshold 80000', () => {
    const s = useSettingsStore.getState()
    expect(s.autoCompactionEnabled).toBe(false)
    expect(s.compactionTokenThreshold).toBe(80000)
  })

  it('setAutoCompactionEnabled and setCompactionTokenThreshold update', () => {
    useSettingsStore.getState().setAutoCompactionEnabled(true)
    useSettingsStore.getState().setCompactionTokenThreshold(50000)
    const s = useSettingsStore.getState()
    expect(s.autoCompactionEnabled).toBe(true)
    expect(s.compactionTokenThreshold).toBe(50000)
  })
})
