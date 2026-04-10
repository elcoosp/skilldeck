// src/components/settings/preferences-tab.tsx
import { useRouter } from '@tanstack/react-router'
import { open } from '@tauri-apps/plugin-dialog'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { SettingsSection } from '@/components/settings/settings-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PremiumError } from '@/components/ui/premium-error'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { useAppVersion } from '@/hooks/use-app-version'
import {
  isPlatformNotConfigured,
  usePlatformPreferences
} from '@/hooks/use-platform'
import { commands } from '@/lib/bindings'
import { loadLocale, locales } from '@/lib/i18n'
import type { UpdatePreferencesPayload } from '@/lib/platform'
import { useSettingsStore } from '@/store/settings'

// Component for platform-dependent settings (email, nudges, theme, analytics)
function PlatformDependentSettings() {
  const router = useRouter()
  const { query, update, resendVerification } = usePlatformPreferences()
  const prefs = query.data
  const [emailDraft, setEmailDraft] = useState('')

  const save = (partial: UpdatePreferencesPayload) => {
    update.mutate(partial)
  }

  if (query.isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Loading platform settings…
      </div>
    )
  }

  if (isPlatformNotConfigured(query) || query.isError) {
    return (
      <div className="my-4">
        <PremiumError
          code="☁️"
          title="Platform features unavailable"
          description="Email, nudges, and cloud sync require platform connection."
          action={{
            label: 'Go to Platform',
            onClick: () => router.navigate({ to: '/settings/platform' })
          }}
          className="min-h-[200px]"
        />
      </div>
    )
  }

  return (
    <>
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
    </>
  )
}

export function PreferencesTab() {
  const [syntaxTheme, setSyntaxTheme] = useState('base16-mocha')

  // Local settings (not dependent on platform)
  const settingsLanguage = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const codeBlockMaxHeight = useSettingsStore((s) => s.codeBlockMaxHeight)
  const setCodeBlockMaxHeight = useSettingsStore((s) => s.setCodeBlockMaxHeight)
  const preferredEditor = useSettingsStore((s) => s.preferredEditor)
  const setPreferredEditor = useSettingsStore((s) => s.setPreferredEditor)
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
  const version = useAppVersion()

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
      {/* Platform-dependent settings (email, nudges, theme, analytics) */}
      <PlatformDependentSettings />

      {/* Syntax Theme */}
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

      {/* Preferred Editor */}
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

      {/* Auto Compaction */}
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

      {/* App version – with bottom padding */}
      <p className="pt-6 pb-6 text-center text-xs text-muted-foreground">
        SkillDeck v{version}
      </p>
    </div>
  )
}
