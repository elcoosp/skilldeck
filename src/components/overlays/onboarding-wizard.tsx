/**
 * OnboardingWizard — multi-step first-run experience.
 *
 * Steps:
 *  1. Welcome  — win-theme overview
 *  2. API Key  — set at least one provider key
 *  3. Platform — optional email opt-in for team tips & referral rewards
 *  4. Done     — launch CTA
 */

import { useState } from 'react'
import { ArrowRight, Check, Key, Mail, Rocket, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useUIStore } from '@/store/ui'
import { setApiKey } from '@/lib/invoke'
import {
  updatePlatformPreferences,
  ensurePlatformRegistration
} from '@/lib/platform'

type Step = 'welcome' | 'apikey' | 'platform' | 'done'

export function OnboardingWizard() {
  const onboardingComplete = useUIStore((s) => s.onboardingComplete)
  const setOnboardingComplete = useUIStore((s) => s.setOnboardingComplete)

  const [step, setStep] = useState<Step>('welcome')
  const [email, setEmail] = useState('')
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [saving, setSaving] = useState(false)

  // If onboarding already completed, don't render anything
  if (onboardingComplete) return null

  async function saveApiKey() {
    if (!apiKeyDraft.trim()) {
      setStep('platform')
      return
    }
    setSaving(true)
    try {
      await setApiKey({ provider: 'claude', key: apiKeyDraft.trim() })
      toast.success('API key saved')
      setStep('platform')
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save key')
    } finally {
      setSaving(false)
    }
  }

  async function savePlatformEmail() {
    setSaving(true)
    try {
      await ensurePlatformRegistration()
      if (email.trim()) {
        await updatePlatformPreferences({
          email: email.trim(),
          analytics_opt_in: false
        })
        toast.success('Email saved — check your inbox to verify')
      }
      setStep('done')
    } catch {
      // Non-fatal — platform features are optional
      setStep('done')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{
              width:
                step === 'welcome'
                  ? '25%'
                  : step === 'apikey'
                    ? '50%'
                    : step === 'platform'
                      ? '75%'
                      : '100%'
            }}
          />
        </div>

        <div className="p-8">
          {step === 'welcome' && (
            <WelcomeStep onNext={() => setStep('apikey')} />
          )}
          {step === 'apikey' && (
            <ApiKeyStep
              draft={apiKeyDraft}
              onChange={setApiKeyDraft}
              onNext={saveApiKey}
              onSkip={() => setStep('platform')}
              saving={saving}
            />
          )}
          {step === 'platform' && (
            <PlatformStep
              email={email}
              onChange={setEmail}
              onNext={savePlatformEmail}
              onSkip={() => setStep('done')}
              saving={saving}
            />
          )}
          {step === 'done' && (
            <DoneStep onFinish={() => setOnboardingComplete(true)} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step components ───────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
        <Rocket size={28} className="text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold mb-2">Welcome to SkillDeck</h1>
        <p className="text-muted-foreground">
          Local-first AI orchestration for developers. Your code never leaves
          your machine.
        </p>
      </div>
      <div className="grid gap-3 text-left">
        {[
          {
            icon: <Shield size={16} className="text-emerald-500" />,
            title: 'Privacy Without Compromise',
            desc: 'API keys live in your OS keychain. Code stays local.'
          },
          {
            icon: <Key size={16} className="text-blue-500" />,
            title: 'Team Knowledge That Compounds',
            desc: 'Skills are version-controlled files — share them like code.'
          },
          {
            icon: <Rocket size={16} className="text-violet-500" />,
            title: 'From Chat to Intelligence',
            desc: 'Multi-agent workflows orchestrate complex tasks in parallel.'
          }
        ].map(({ icon, title, desc }) => (
          <div key={title} className="flex gap-3 p-3 rounded-lg bg-muted/40">
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onNext}
        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90"
      >
        Get started <ArrowRight size={16} />
      </button>
    </div>
  )
}

function ApiKeyStep({
  draft,
  onChange,
  onNext,
  onSkip,
  saving
}: {
  draft: string
  onChange: (v: string) => void
  onNext: () => void
  onSkip: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Connect an AI provider</h2>
        <p className="text-sm text-muted-foreground">
          Add your Anthropic API key to unlock Claude. Add more providers later
          in Settings.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Anthropic API Key</label>
        <input
          type="password"
          placeholder="sk-ant-…"
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Stored encrypted in your OS keychain — never uploaded anywhere.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted"
        >
          Skip for now
        </button>
        <button
          onClick={onNext}
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            'Saving…'
          ) : (
            <>
              <span>Next</span> <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function PlatformStep({
  email,
  onChange,
  onNext,
  onSkip,
  saving
}: {
  email: string
  onChange: (v: string) => void
  onNext: () => void
  onSkip: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Stay in the loop (optional)</h2>
        <p className="text-sm text-muted-foreground">
          Get tips on sharing skills with your team and earn rewards for
          referrals. No spam — unsubscribe any time.
        </p>
      </div>
      <div className="flex gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
        <Mail size={18} className="text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">What you'll receive:</p>
          <ul className="mt-1 text-muted-foreground space-y-0.5 text-xs list-none">
            <li>• Weekly skill-sharing tips from the community</li>
            <li>• Referral reward notifications</li>
            <li>• Product updates that matter to developers</li>
          </ul>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Email address</label>
        <input
          type="email"
          placeholder="you@yourteam.com"
          value={email}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted"
        >
          Skip
        </button>
        <button
          onClick={onNext}
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            'Saving…'
          ) : email ? (
            <>
              <span>Save &amp; continue</span> <ArrowRight size={14} />
            </>
          ) : (
            <>
              <span>Continue</span> <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
        <Check size={28} className="text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">You're all set!</h2>
        <p className="text-sm text-muted-foreground">
          Start a conversation, explore your skills, or build a multi-agent
          workflow.
        </p>
      </div>
      <button
        type="button"
        onClick={onFinish}
        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
      >
        Open SkillDeck
      </button>
    </div>
  )
}
