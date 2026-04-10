// src/components/overlays/launch-notification.tsx
/**
 * LaunchNotificationBanner — Product Hunt launch supporter signup.
 *
 * Shown once at the top of the app until dismissed or email is saved.
 * Collects email via the platform preferences endpoint.
 */

import { Rocket, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from '@/components/ui/toast'
import {
  ensurePlatformRegistration,
  updatePlatformPreferences
} from '@/lib/platform'

const DISMISSED_KEY = 'skilldeck:launch-banner-dismissed'

export function LaunchNotificationBanner() {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (!dismissed) setVisible(true)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    try {
      await ensurePlatformRegistration()
      await updatePlatformPreferences({ email: email.trim() })
      setSaved(true)
      toast.success("You're on the list! We'll notify you on launch day.")
      setTimeout(dismiss, 3000)
    } catch {
      toast.error('Could not save email — try again later.')
    } finally {
      setSaving(false)
    }
  }

  if (!visible) return null

  return (
    <div className="relative w-full bg-primary text-primary-foreground px-4 py-2.5 flex items-center gap-3 text-sm">
      <Rocket size={15} className="shrink-0" />

      {saved ? (
        <span className="flex-1 font-medium">
          You're on the list! 🎉 We'll ping you on launch day.
        </span>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex items-center gap-2 flex-wrap"
        >
          <span className="font-medium whitespace-nowrap">
            SkillDeck is launching on Product Hunt →
          </span>
          <span className="text-primary-foreground/80 text-xs whitespace-nowrap">
            Get notified on launch day:
          </span>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md px-2.5 py-1 text-xs bg-white/20 border border-white/30 placeholder:text-white/60 focus:outline-none focus:bg-white/30 text-white w-44"
          />
          <button
            type="submit"
            disabled={!email.trim() || saving}
            className="px-3 py-1 rounded-md bg-white text-primary font-semibold text-xs hover:bg-white/90 disabled:opacity-60 whitespace-nowrap"
          >
            {saving ? 'Saving…' : 'Notify me'}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 p-1 hover:bg-white/20 rounded-md transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
