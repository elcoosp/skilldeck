/**
 * SettingsOverlay — modal dialog with tabbed sections covering API keys,
 * profiles, tool approval policies, and theme preferences.
 *
 * Keeps logic thin: every mutation delegates to invoke() or useSettingsStore.
 */

import { useState } from 'react'
import { Eye, EyeOff, Key, Layers, ShieldCheck, Sun, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { useSettingsStore } from '@/store/settings'
import {
  setApiKey,
  deleteApiKey,
  validateApiKey,
  listApiKeys
} from '@/lib/invoke'
import { useQuery } from '@tanstack/react-query'

type SettingsTab = 'apikeys' | 'profiles' | 'approvals' | 'appearance'

export function SettingsOverlay() {
  const [tab, setTab] = useState<SettingsTab>('apikeys')
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl h-[520px] rounded-xl border border-border bg-background shadow-2xl flex overflow-hidden"
        role="dialog"
        aria-label="Settings"
      >
        {/* Sidebar */}
        <nav className="w-44 shrink-0 border-r border-border bg-muted/30 p-2 flex flex-col gap-0.5">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Settings
          </p>
          {(
            [
              { id: 'apikeys', label: 'API Keys', Icon: Key },
              { id: 'profiles', label: 'Profiles', Icon: Layers },
              { id: 'approvals', label: 'Tool Approvals', Icon: ShieldCheck },
              { id: 'appearance', label: 'Appearance', Icon: Sun }
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left transition-colors',
                tab === id
                  ? 'bg-primary/10 text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}

          <div className="mt-auto">
            <button
              onClick={() => setSettingsOpen(false)}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="size-4" />
              Close
            </button>
          </div>
        </nav>

        {/* Content pane */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'apikeys' && <ApiKeysTab />}
          {tab === 'profiles' && <ProfilesTab />}
          {tab === 'approvals' && <ApprovalsTab />}
          {tab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  )
}

// ── API Keys tab ──────────────────────────────────────────────────────────────

const PROVIDERS = [
  { id: 'claude', label: 'Anthropic (Claude)', placeholder: 'sk-ant-…' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-…' },
  { id: 'ollama', label: 'Ollama (local)', placeholder: 'optional token' }
]

function ApiKeysTab() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const { data: keyStatuses = [], refetch } = useQuery({
    queryKey: ['api-keys'],
    queryFn: listApiKeys
  })

  const handleSave = async (provider: string) => {
    const key = values[provider]?.trim()
    if (!key) return

    const valid = await validateApiKey(provider, key)
    if (!valid) {
      toast.error(`Invalid format for ${provider} key`)
      return
    }

    setSaving((s) => ({ ...s, [provider]: true }))
    try {
      await setApiKey(provider, key)
      setValues((v) => ({ ...v, [provider]: '' }))
      refetch()
      toast.success(`${provider} key saved`)
    } catch (err) {
      toast.error(`Failed to save key: ${err}`)
    } finally {
      setSaving((s) => ({ ...s, [provider]: false }))
    }
  }

  const handleDelete = async (provider: string) => {
    try {
      await deleteApiKey(provider)
      refetch()
      toast.success(`${provider} key removed`)
    } catch (err) {
      toast.error(`Failed to remove key: ${err}`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-0.5">API Keys</h2>
        <p className="text-sm text-muted-foreground">
          Keys are stored exclusively in the OS keychain — never in the
          database.
        </p>
      </div>

      {PROVIDERS.map(({ id, label, placeholder }) => {
        const status = keyStatuses.find((k) => k.provider === id)
        const hasKey = status?.has_key ?? false

        return (
          <div key={id} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{label}</label>
              {hasKey && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                  ● Key stored
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={visible[id] ? 'text' : 'password'}
                  value={values[id] ?? ''}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [id]: e.target.value }))
                  }
                  placeholder={hasKey ? '••••••••••••• (replace)' : placeholder}
                  className={cn(
                    'w-full h-8 rounded-md border border-input bg-background px-3 pr-9 text-sm',
                    'placeholder:text-muted-foreground focus-visible:outline-none',
                    'focus-visible:ring-2 focus-visible:ring-ring/50'
                  )}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave(id)}
                />
                <button
                  type="button"
                  onClick={() => setVisible((v) => ({ ...v, [id]: !v[id] }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {visible[id] ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>

              <button
                onClick={() => handleSave(id)}
                disabled={!values[id]?.trim() || saving[id]}
                className={cn(
                  'px-3 h-8 rounded-md text-sm font-medium transition-colors',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {saving[id] ? '…' : 'Save'}
              </button>

              {hasKey && (
                <button
                  onClick={() => handleDelete(id)}
                  className="px-3 h-8 rounded-md text-sm font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Profiles tab ──────────────────────────────────────────────────────────────

function ProfilesTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold mb-0.5">Profiles</h2>
        <p className="text-sm text-muted-foreground">
          Each profile pairs a name with a model provider and ID.
        </p>
      </div>
      <p className="text-sm text-muted-foreground italic">
        Profile management coming in v1.1.
      </p>
    </div>
  )
}

// ── Tool Approvals tab ────────────────────────────────────────────────────────

const APPROVAL_FIELDS: Array<{
  key: keyof ReturnType<typeof useSettingsStore.getState>['toolApprovals']
  label: string
  description: string
}> = [
  {
    key: 'autoApproveReads',
    label: 'Auto-approve file reads',
    description: 'Skip the approval dialog for read-only filesystem tools'
  },
  {
    key: 'autoApproveWrites',
    label: 'Auto-approve file writes',
    description: 'Skip approval for file creation and modification'
  },
  {
    key: 'autoApproveShell',
    label: 'Auto-approve shell commands',
    description: 'Never require approval for shell execution (⚠ dangerous)'
  },
  {
    key: 'autoApproveHttpRequests',
    label: 'Auto-approve HTTP requests',
    description: 'Skip approval for outbound HTTP tool calls'
  }
]

function ApprovalsTab() {
  const toolApprovals = useSettingsStore((s) => s.toolApprovals)
  const setToolApprovals = useSettingsStore((s) => s.setToolApprovals)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold mb-0.5">Tool Approvals</h2>
        <p className="text-sm text-muted-foreground">
          Configure which tool categories skip the approval gate. All options
          are off by default for maximum safety.
        </p>
      </div>

      <div className="space-y-3">
        {APPROVAL_FIELDS.map(({ key, label, description }) => (
          <label
            key={key}
            className="flex items-start gap-3 cursor-pointer group"
          >
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={toolApprovals[key]}
                onChange={(e) => setToolApprovals({ [key]: e.target.checked })}
                className="sr-only"
              />
              <div
                className={cn(
                  'size-4 rounded border-2 flex items-center justify-center transition-colors',
                  toolApprovals[key]
                    ? 'bg-primary border-primary'
                    : 'border-muted-foreground/40 group-hover:border-primary/50'
                )}
              >
                {toolApprovals[key] && (
                  <svg
                    className="size-2.5 text-primary-foreground"
                    fill="none"
                    viewBox="0 0 12 12"
                  >
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Appearance tab ────────────────────────────────────────────────────────────

function AppearanceTab() {
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold mb-0.5">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Choose your preferred theme.
        </p>
      </div>

      <div className="flex gap-2">
        {(['light', 'dark', 'system'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={cn(
              'flex-1 py-2 rounded-md border text-sm font-medium capitalize transition-colors',
              theme === t
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
