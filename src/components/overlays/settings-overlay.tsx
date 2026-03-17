// src/components/overlays/settings-overlay.tsx
/**
 * SettingsOverlay — modal dialog with tabbed sections covering API keys,
 * profiles, tool approval policies, and theme preferences.
 */

import { X } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { useSettingsStore } from '@/store/settings'
import { commands } from '@/lib/bindings'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ProfileData, ApiKeyStatus } from '@/lib/bindings'
import { PreferencesTab } from '@/components/settings/preferences-tab'
import { ReferralTab } from '@/components/settings/referral-tab'
import { PlatformTab } from '@/components/settings/platform-tab'

export function SettingsOverlay() {
  const settingsTab = useUIStore((s) => s.settingsTab)
  const setSettingsTab = useUIStore((s) => s.setSettingsTab)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setSettingsOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setSettingsOpen(false)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
        className="w-full max-w-2xl h-[520px] rounded-xl border border-border bg-background shadow-2xl flex overflow-hidden"
      >
        {/* Sidebar */}
        <nav className="w-44 shrink-0 border-r border-border bg-muted/30 p-2 flex flex-col gap-0.5">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Settings
          </p>
          {(
            [
              { id: 'apikeys', label: 'API Keys', Icon: X },
              { id: 'profiles', label: 'Profiles', Icon: X },
              { id: 'approvals', label: 'Tool Approvals', Icon: X },
              { id: 'appearance', label: 'Appearance', Icon: X },
              { id: 'preferences', label: 'Preferences', Icon: X },
              { id: 'platform', label: 'Platform', Icon: X },
              { id: 'referral', label: 'Refer & Earn', Icon: X }
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSettingsTab(id)}
              className={cn(
                'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left transition-colors',
                settingsTab === id
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
              type="button"
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
          {settingsTab === 'apikeys' && <ApiKeysTab />}
          {settingsTab === 'profiles' && <ProfilesTab />}
          {settingsTab === 'approvals' && <ApprovalsTab />}
          {settingsTab === 'appearance' && <AppearanceTab />}
          {settingsTab === 'preferences' && <PreferencesTab />}
          {settingsTab === 'platform' && <PlatformTab />}
          {settingsTab === 'referral' && <ReferralTab />}
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
    queryFn: async () => {
      const res = await commands.listApiKeys()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })

  const handleSave = async (provider: string) => {
    const key = values[provider]?.trim()
    if (!key) return

    const validRes = await commands.validateApiKey(provider, key)
    if (validRes.status === 'error' || !validRes.data) {
      toast.error(`Invalid format for ${provider} key`)
      return
    }

    setSaving((s) => ({ ...s, [provider]: true }))
    try {
      const res = await commands.setApiKey(provider, key)
      if (res.status === 'error') throw new Error(res.error)
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
      const res = await commands.deleteApiKey(provider)
      if (res.status === 'error') throw new Error(res.error)
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
        const status = keyStatuses.find((k: ApiKeyStatus) => k.provider === id)
        const hasKey = status?.has_key ?? false

        return (
          <div key={id} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{label}</span>
              {hasKey && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Key stored
                </Badge>
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
                    <X className="size-3.5" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </button>
              </div>

              <Button
                size="sm"
                onClick={() => handleSave(id)}
                disabled={!values[id]?.trim() || saving[id]}
              >
                {saving[id] ? '…' : 'Save'}
              </Button>

              {hasKey && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(id)}
                >
                  Remove
                </Button>
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
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newProvider, setNewProvider] = useState('ollama')
  const [newModel, setNewModel] = useState('')

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const res = await commands.listProfiles()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })

  const { data: ollamaModels = [] } = useQuery({
    queryKey: ['available-models', 'ollama'],
    queryFn: async () => {
      const res = await commands.listOllamaModels()
      if (res.status === 'ok') return res.data
      throw new Error(res.error)
    }
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await commands.createProfile(
        newName.trim(),
        newProvider,
        newModel.trim() || defaultModel()
      )
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Profile created')
      setShowNew(false)
      setNewName('')
      setNewModel('')
      setNewProvider('ollama')
    },
    onError: (e: unknown) => toast.error(String(e))
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await commands.deleteProfile(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Profile deleted')
    },
    onError: (e: unknown) => toast.error(String(e))
  })

  const defaultMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await commands.setDefaultProfile(id)
      if (res.status === 'error') throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Default profile updated')
    },
    onError: (e: unknown) => toast.error(String(e))
  })

  const PROVIDER_OPTIONS = [
    { id: 'ollama', label: 'Ollama (local)' },
    { id: 'claude', label: 'Anthropic (Claude)' },
    { id: 'openai', label: 'OpenAI' }
  ]

  function defaultModel() {
    if (newProvider === 'ollama')
      return ollamaModels[0]?.id ?? 'llama3.2:latest'
    if (newProvider === 'claude') return 'claude-sonnet-4-5'
    if (newProvider === 'openai') return 'gpt-4o'
    return ''
  }

  const getProviderName = (provider: string | { id: string; name: string }) => {
    if (typeof provider === 'string') {
      const found = PROVIDER_OPTIONS.find((p) => p.id === provider)
      return found ? found.label : provider
    }
    return provider.name || provider.id
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold mb-0.5">Profiles</h2>
          <p className="text-sm text-muted-foreground">
            Each profile pairs a name with a model provider and ID.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNew((v) => !v)}>
          <X className="size-3 mr-1" />
          New
        </Button>
      </div>

      {/* New profile form */}
      {showNew && (
        <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
          <input
            placeholder="Profile name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full h-7 rounded-md border border-input bg-background px-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <select
            value={newProvider}
            onChange={(e) => {
              setNewProvider(e.target.value)
              setNewModel('')
            }}
            className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {newProvider === 'ollama' ? (
            <select
              value={newModel || defaultModel()}
              onChange={(e) => setNewModel(e.target.value)}
              className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {ollamaModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          ) : (
            <input
              placeholder={`Model ID (e.g. ${defaultModel()})`}
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              className="w-full h-7 rounded-md border border-input bg-background px-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          )}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => createMut.mutate()}
              disabled={!newName.trim() || createMut.isPending}
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Profile list */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No profiles yet.</p>
      ) : (
        <div className="space-y-2">
          {profiles.map((p: ProfileData) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                p.is_default
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  {p.is_default && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      default
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {getProviderName(p.model_provider)} · {p.model_id}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!p.is_default && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => defaultMut.mutate(p.id)}
                    disabled={defaultMut.isPending}
                    title="Set as default"
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => deleteMut.mutate(p.id)}
                  disabled={deleteMut.isPending}
                  title="Delete profile"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
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
                    role="img"
                    aria-label="Checked"
                  >
                    <title>Checked</title>
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
            type="button"
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
