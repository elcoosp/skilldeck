import { useRouter } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import {
  AlertTriangle,
  Bell,
  Code,
  Globe,
  Mail,
  Maximize2,
  Palette,
  Shield
} from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/components/ui/toast'
import { SettingsSection } from '@/components/settings/settings-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAppVersion } from '@/hooks/use-app-version'
import {
  isPlatformNotConfigured,
  usePlatformPreferences
} from '@/hooks/use-platform'
import { useProfiles, useUpdateProfile } from '@/hooks/use-profiles'
import { useProviderReady } from '@/hooks/use-provider-ready'
import { commands } from '@/lib/bindings'
import { loadLocale, locales } from '@/lib/i18n'
import type { UpdatePreferencesPayload } from '@/lib/platform'
import { useSettingsStore } from '@/store/settings'

export function PreferencesTab() {
  const router = useRouter()
  const { query, update, resendVerification } = usePlatformPreferences()
  const prefs = query.data

  const { data: profiles = [], isLoading: profilesLoading } = useProfiles()
  const updateProfile = useUpdateProfile()

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  )
  const [emailDraft, setEmailDraft] = useState('')
  const [systemPromptDraft, setSystemPromptDraft] = useState('')
  const [syntaxTheme, setSyntaxTheme] = useState('base16-mocha')

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId)
  const { data: readiness, isLoading: readinessLoading } = useProviderReady(
    selectedProfileId ?? undefined
  )

  // Language preference
  const settingsLanguage = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const defaultProvider = useSettingsStore((s) => s.defaultProvider)

  // Code block max height
  const codeBlockMaxHeight = useSettingsStore((s) => s.codeBlockMaxHeight)
  const setCodeBlockMaxHeight = useSettingsStore((s) => s.setCodeBlockMaxHeight)

  // Concierge UI: preferred editor
  const preferredEditor = useSettingsStore((s) => s.preferredEditor)
  const setPreferredEditor = useSettingsStore((s) => s.setPreferredEditor)

  // Concierge UI: auto-compaction
  const autoCompactionEnabled = useSettingsStore((s) => s.autoCompactionEnabled)
  const setAutoCompactionEnabled = useSettingsStore(
    (s) => s.setAutoCompactionEnabled
  )
  const compactionTokenThreshold = useSettingsStore(
    (s) => s.compactionTokenThreshold
  )
  const setCompactionTokenThreshold = useSettingsStore(
    (s) => s.setCompactionTokenThreshold
  )

  // App version
  const version = useAppVersion()

  if (query.isLoading || profilesLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Loading preferences…
      </div>
    )
  }

  // Platform not configured – show registration prompt
  if (isPlatformNotConfigured(query)) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Platform not configured.
        </p>
        <Button
          size="sm"
          onClick={() => router.navigate({ to: '/settings/platform' })}
        >
          Go to Platform Settings
        </Button>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="p-4 text-sm text-destructive">
        Could not load platform preferences. Make sure you're connected.
      </div>
    )
  }

  function save(partial: UpdatePreferencesPayload) {
    update.mutate(partial)
  }

  const handleSaveSystemPrompt = () => {
    if (!selectedProfile) return
    updateProfile.mutate({
      id: selectedProfile.id,
      system_prompt: systemPromptDraft
    })
  }

  const handleThemeChange = async (value: string) => {
    let css: string
    if (value === 'custom') {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Theme Files', extensions: ['tmTheme'] }]
      })
      if (!selected) return
      const result = await commands.setThemeFromFile(selected as string)
      if (result.status === 'error') {
        toast.error(result.error)
        return
      }
      css = result.data
      setSyntaxTheme('custom')
    } else {
      const result = await commands.setBuiltInTheme(value)
      if (result.status === 'error') {
        toast.error(result.error)
        return
      }
      css = result.data
      setSyntaxTheme(value)
    }
    const style = document.getElementById('syntax-theme')
    if (style) style.textContent = css
  }

  return (
    <div className="divide-y divide-border">
      {/* Profile selector */}
      <SettingsSection
        title="Profile"
        description="Select a profile to edit its settings"
      >
        <Select
          value={selectedProfileId ?? ''}
          onValueChange={(id) => {
            setSelectedProfileId(id)
            const profile = profiles.find((p) => p.id === id)
            setSystemPromptDraft(profile?.system_prompt ?? '')
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a profile to edit" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} {p.is_default ? '(default)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsSection>

      {/* System Prompt editor */}
      {selectedProfile && (
        <SettingsSection
          title="System Prompt"
          description="Base instructions for the model"
        >
          <Textarea
            placeholder="You are a helpful assistant…"
            value={systemPromptDraft}
            onChange={(e) => setSystemPromptDraft(e.target.value)}
            rows={6}
          />
          <div className="flex justify-end mt-2">
            <Button
              size="sm"
              onClick={handleSaveSystemPrompt}
              disabled={updateProfile.isPending}
            >
              Save Prompt
            </Button>
          </div>

          {/* Provider Readiness Indicator */}
          {!readinessLoading && readiness && (
            <div className="mt-3">
              {readiness.status.status === 'ready' ? (
                <Badge
                  variant="outline"
                  className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20"
                >
                  ✓ Provider ready
                </Badge>
              ) : (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-medium text-amber-800 dark:text-amber-300">
                      Provider Not Ready
                    </span>
                  </div>
                  <p className="text-amber-700 dark:text-amber-400 mt-1">
                    {readiness.status.reason} {readiness.status.fix_action}
                  </p>
                </div>
              )}
            </div>
          )}
        </SettingsSection>
      )}

      {/* Local mode hint */}
      {defaultProvider === 'ollama' && (
        <div className="rounded-md bg-primary/5 p-3 text-xs text-muted-foreground border border-primary/20">
          <span className="font-medium">🦙 Local mode</span> – Using Ollama on
          your machine. No API key required. Change provider in Profiles.
        </div>
      )}

      {/* Email & Verification */}
      <SettingsSection
        title="Email"
        description="Used for nudges and referral rewards"
      >
        <p className="text-muted-foreground mb-3">
          Used for nudges and referral rewards. Your data stays on your machine
          — we only sync what you choose.
        </p>
        <div className="flex gap-2">
          <input
            id="email-input"
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={prefs?.email ?? 'you@example.com'}
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
          />
          <button
            type="button"
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            disabled={!emailDraft || update.isPending}
            onClick={() => {
              save({ email: emailDraft })
              setEmailDraft('')
            }}
          >
            Save
          </button>
        </div>
        {prefs?.email && (
          <div className="mt-2 flex items-center gap-2">
            {prefs.email_verified ? (
              <span className="text-xs text-emerald-600 font-medium">
                ✓ Verified
              </span>
            ) : (
              <>
                <span className="text-xs text-amber-600">Unverified</span>
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => resendVerification.mutate()}
                  disabled={resendVerification.isPending}
                >
                  Resend
                </button>
              </>
            )}
          </div>
        )}
      </SettingsSection>

      {/* Nudge Frequency */}
      <SettingsSection
        title="Nudge Frequency"
        description="How often should SkillDeck send you tips and reminders?"
      >
        <div className="flex flex-col gap-1.5">
          {(
            [
              { value: 'daily', label: 'Daily — keep me in the loop' },
              { value: 'weekly', label: 'Weekly — just the highlights' },
              { value: 'important_only', label: 'Important only — less noise' }
            ] as const
          ).map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="nudge_frequency"
                value={value}
                checked={prefs?.nudge_frequency === value}
                onChange={() => save({ nudge_frequency: value })}
                className="accent-primary"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs?.nudge_opt_out ?? false}
            onChange={(e) => save({ nudge_opt_out: e.target.checked })}
            className="accent-primary"
          />
          <span className="text-muted-foreground">Opt out of all nudges</span>
        </label>
      </SettingsSection>

      {/* Notification channels */}
      <SettingsSection
        title="Notification Channels"
        description="Where to receive notifications"
      >
        {(
          [
            { value: 'in-app', label: 'In-app toasts' },
            { value: 'email', label: 'Email (requires verified address)' }
          ] as const
        ).map(({ value, label }) => {
          const rawChannels = prefs?.notification_channels ?? ['in-app']
          const channels = rawChannels.filter(
            (c): c is 'in-app' | 'email' => c === 'in-app' || c === 'email'
          )
          const checked = channels.includes(value)
          return (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer mb-1.5"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...channels, value]
                    : channels.filter((c) => c !== value)
                  save({ notification_channels: next })
                }}
                className="accent-primary"
              />
              <span>{label}</span>
            </label>
          )
        })}
      </SettingsSection>

      {/* App Theme (UI) */}
      <SettingsSection
        title="App Theme"
        description="Color scheme for the application"
      >
        <select
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={prefs?.theme_preference ?? 'system'}
          onChange={(e) =>
            save({
              theme_preference: e.target.value as 'system' | 'light' | 'dark'
            })
          }
        >
          <option value="system">System default</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </SettingsSection>

      {/* Syntax Theme (code highlighting) */}
      <SettingsSection
        title="Syntax Theme"
        description="Theme for code blocks in messages"
      >
        <Select value={syntaxTheme} onValueChange={handleThemeChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="base16-mocha">Base16 Mocha</SelectItem>
            <SelectItem value="solarized-dark">Solarized Dark</SelectItem>
            <SelectItem value="solarized-light">Solarized Light</SelectItem>
            <SelectItem value="custom">Custom...</SelectItem>
          </SelectContent>
        </Select>
      </SettingsSection>

      {/* Code Block Max Height */}
      <SettingsSection
        title="Code Block Max Height"
        description="Maximum height of code blocks in messages. Scroll inside long code blocks."
      >
        <Select
          value={String(codeBlockMaxHeight)}
          onValueChange={(val) => setCodeBlockMaxHeight(Number(val))}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Select height" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="200">200px</SelectItem>
            <SelectItem value="300">300px</SelectItem>
            <SelectItem value="384">384px (default)</SelectItem>
            <SelectItem value="600">600px</SelectItem>
            <SelectItem value="99999">Unlimited</SelectItem>
          </SelectContent>
        </Select>
      </SettingsSection>

      {/* Language */}
      <SettingsSection title="Language" description="UI language">
        <select
          value={settingsLanguage}
          onChange={(e) => {
            const lang = e.target.value
            setLanguage(lang)
            loadLocale(lang as keyof typeof locales)
          }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          {Object.entries(locales).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          UI language. Translations are community contributed; help us add more!
        </p>
      </SettingsSection>

      {/* Preferred Editor (F08) */}
      <SettingsSection
        title="Preferred Editor"
        description="Choose which editor to open workspace folders in"
      >
        <Select
          value={preferredEditor}
          onValueChange={(v) =>
            setPreferredEditor(v as 'vscode' | 'cursor' | 'system')
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vscode">VS Code</SelectItem>
            <SelectItem value="cursor">Cursor</SelectItem>
            <SelectItem value="system">System Default</SelectItem>
          </SelectContent>
        </Select>
      </SettingsSection>

      {/* Auto Compaction (F12) */}
      <SettingsSection
        title="Context Management"
        description="Automatically compress long conversations to save context window space"
      >
        <div className="flex items-center justify-between">
          <label htmlFor="compaction-toggle" className="text-sm">
            Auto-compaction
          </label>
          <Switch
            id="compaction-toggle"
            checked={autoCompactionEnabled}
            onCheckedChange={(v) => setAutoCompactionEnabled(v)}
          />
        </div>
        {autoCompactionEnabled && (
          <div className="mt-3">
            <label className="text-sm text-muted-foreground">
              Threshold: {compactionTokenThreshold.toLocaleString()} tokens
            </label>
            <input
              type="range"
              min="20000"
              max="200000"
              step="10000"
              value={compactionTokenThreshold}
              onChange={(e) =>
                setCompactionTokenThreshold(Number(e.target.value))
              }
              className="mt-1 w-full"
            />
          </div>
        )}
      </SettingsSection>

      {/* Analytics consent */}
      <SettingsSection
        title="Privacy"
        description="SkillDeck never sells your data"
      >
        <p className="text-muted-foreground mb-3">
          SkillDeck never sells your data. Anonymous usage analytics help us
          improve the product — opt in only if you're comfortable.
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs?.analytics_opt_in ?? false}
            onChange={(e) => save({ analytics_opt_in: e.target.checked })}
            className="accent-primary"
          />
          <span>Share anonymous usage analytics</span>
        </label>
      </SettingsSection>

      {/* App version */}
      <p className="pt-6 text-center text-xs text-muted-foreground">
        SkillDeck v{version}
      </p>
    </div>
  )
}
