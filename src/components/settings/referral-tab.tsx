/**
 * ReferralTab — Share SkillDeck and track your referral rewards.
 *
 * Win theme: "Team Knowledge That Compounds"
 * Every developer you bring onboard multiplies your team's AI knowledge.
 */

import { useState } from 'react'
import { Copy, ExternalLink, Gift, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useReferral } from '@/hooks/use-platform'

const REFERRAL_BASE_URL = 'https://skilldeck.dev/r'

export function ReferralTab() {
  const { stats, create } = useReferral()

  const code = stats.data?.code
  const referralUrl = code ? `${REFERRAL_BASE_URL}/${code.code}` : null

  function copyCode() {
    if (!referralUrl) return
    navigator.clipboard.writeText(referralUrl)
    toast.success('Referral link copied!')
  }

  function shareVia(channel: 'twitter' | 'linkedin' | 'email') {
    if (!referralUrl) return
    const text = encodeURIComponent(
      `I use SkillDeck for local-first AI orchestration — your code never leaves your machine. Check it out: ${referralUrl}`
    )
    const urls: Record<typeof channel, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`,
      email: `mailto:?subject=${encodeURIComponent('Check out SkillDeck')}&body=${text}`
    }
    window.open(urls[channel], '_blank')
  }

  if (stats.isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Loading referral data…
      </div>
    )
  }

  return (
    <div className="space-y-6 text-sm">
      {/* Hero micro-story */}
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
        <p className="font-medium text-foreground mb-1">
          Your best prompts shouldn't die in a chat window.
        </p>
        <p className="text-muted-foreground">
          Developers who share SkillDeck bring an average of 3 teammates on
          board. Each team member who joins compounds the knowledge base for
          everyone.
        </p>
      </div>

      {/* Code display / create */}
      {code ? (
        <div className="space-y-3">
          <p className="font-medium">Your referral link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap">
              {referralUrl}
            </code>
            <button
              onClick={copyCode}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="Copy link"
            >
              <Copy size={14} />
            </button>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2">
            <ShareButton
              label="Twitter / X"
              onClick={() => shareVia('twitter')}
            />
            <ShareButton
              label="LinkedIn"
              onClick={() => shareVia('linkedin')}
            />
            <ShareButton label="Email" onClick={() => shareVia('email')} />
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-muted-foreground mb-4">
            Create your referral link and start earning rewards.
          </p>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50"
            disabled={create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Creating…' : 'Create my referral link'}
          </button>
        </div>
      )}

      {/* Stats */}
      {stats.data && (
        <div className="grid grid-cols-3 gap-3">
          <Stat
            icon={<Users size={14} />}
            label="Signups"
            value={stats.data.total_signups}
          />
          <Stat
            icon={<ExternalLink size={14} />}
            label="Conversions"
            value={stats.data.total_conversions}
          />
          <Stat
            icon={<Gift size={14} />}
            label="Rewards"
            value={stats.data.rewards_earned}
            highlight
          />
        </div>
      )}

      {/* Usage indicator */}
      {code && (
        <div className="text-xs text-muted-foreground">
          {code.uses}/{code.max_uses} uses
          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(code.uses / code.max_uses) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ShareButton({
  label,
  onClick
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-1.5 rounded-md border border-border hover:bg-muted text-xs font-medium transition-colors"
    >
      {label}
    </button>
  )
}

function Stat({
  icon,
  label,
  value,
  highlight
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-1 ${highlight ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30'}`}
    >
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <span
        className={`text-base font-semibold ${highlight ? 'text-primary' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
