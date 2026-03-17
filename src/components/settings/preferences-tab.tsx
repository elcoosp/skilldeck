// src/components/settings/preferences-tab.tsx
/**
 * PreferencesTab — Platform preferences panel inside SettingsOverlay.
 */

import { useState } from 'react'
import { Bell, Globe, Mail, Palette, Shield } from 'lucide-react'
import { usePlatformPreferences } from '@/hooks/use-platform'
import type { UpdatePreferencesPayload } from '@/lib/platform'

export function PreferencesTab() {
  const { query, update, resendVerification } = usePlatformPreferences()
  const prefs = query.data

  const [emailDraft, setEmailDraft] = useState('')

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Loading preferences…
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

  return (
    <div className="space-y-6 text-sm">
      {/* Email & Verification */}
      <Section icon={<Mail size={14} />} title="Email">
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
      </Section>

      {/* Nudge Frequency */}
      <Section icon={<Bell size={14} />} title="Nudge Frequency">
        <p className="text-muted-foreground mb-3">
          How often should SkillDeck send you tips and reminders?
        </p>
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
      </Section>

      {/* Notification channels */}
      <Section icon={<Globe size={14} />} title="Notification Channels">
        {(
          [
            { value: 'in-app', label: 'In-app toasts' },
            { value: 'email', label: 'Email (requires verified address)' }
          ] as const
        ).map(({ value, label }) => {
          const rawChannels = prefs?.notification_channels ?? ['in-app']
          // Ensure type safety
          const channels = rawChannels.filter((c): c is 'in-app' | 'email' =>
            c === 'in-app' || c === 'email'
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
      </Section>

      {/* Theme */}
      <Section icon={<Palette size={14} />} title="Theme">
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
      </Section>

      {/* Analytics consent */}
      <Section icon={<Shield size={14} />} title="Privacy">
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
      </Section>
    </div>
  )
}

function Section({
  icon,
  title,
  children
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3 font-medium text-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}
