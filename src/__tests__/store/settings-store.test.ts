import { describe, it, expect, beforeEach } from 'vitest'
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
    defaultModelId: 'claude-sonnet-4-5',
    language: 'en'
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
    for (const [key, value] of Object.entries(toolApprovals)) {
      expect(value).toBe(false, `${key} should default to false`)
    }
  })

  it('setToolApprovals patches a single field', () => {
    useSettingsStore.getState().setToolApprovals({ autoApproveReads: true })
    expect(useSettingsStore.getState().toolApprovals.autoApproveReads).toBe(
      true
    )
    // Others unchanged
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

  it('autoApproveShell stays false by default (security requirement)', () => {
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
