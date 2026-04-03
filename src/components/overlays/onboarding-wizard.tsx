// src/components/overlays/onboarding-wizard.tsx
import { ArrowRight, Check, Key, Mail, Rocket, Shield } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from '@tanstack/react-router'
import { useCreateConversation } from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'
import { commands } from '@/lib/bindings'
import {
  ensurePlatformRegistration,
  updatePlatformPreferences
} from '@/lib/platform'
import { useConversationStore } from '@/store/conversation'
import { useUILayoutStore } from '@/store/ui-layout'
import { useUIPersistentStore } from '@/store/ui-state'

type Step = 'welcome' | 'apikey' | 'platform' | 'done'

export function OnboardingWizard() {
  const router = useRouter()
  const onboardingComplete = useUIPersistentStore((s) => s.onboardingComplete)
  const setOnboardingComplete = useUIPersistentStore(
    (s) => s.setOnboardingComplete
  )
  const setPlatformFeaturesEnabled = useUIPersistentStore(
    (s) => s.setPlatformFeaturesEnabled
  )
  const setActiveConversation = useConversationStore(
    (s) => s.setActiveConversation
  )
  const setRightTab = useUILayoutStore((s) => s.setRightTab)

  const [step, setStep] = useState<Step>('welcome')
  const [email, setEmail] = useState('')
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: profiles } = useProfiles()
  const defaultProfile = profiles?.find((p) => p.is_default) ?? profiles?.[0]
  const createConversation = useCreateConversation(defaultProfile?.id)

  if (onboardingComplete) return null

  async function saveApiKey() {
    if (!apiKeyDraft.trim()) {
      setStep('platform')
      return
    }
    setSaving(true)
    try {
      const res = await commands.setApiKey('claude', apiKeyDraft.trim())
      if (res.status === 'error') throw new Error(res.error)
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
      setPlatformFeaturesEnabled(true)
      setStep('done')
    } catch {
      setPlatformFeaturesEnabled(false)
      setStep('done')
    } finally {
      setSaving(false)
    }
  }

  const handleApiKeySkip = async () => {
    setSaving(true)
    try {
      const profilesRes = await commands.listProfiles(false)
      if (profilesRes.status === 'ok' && profilesRes.data.length === 0) {
        await commands.createProfile(
          'Local (Ollama)',
          'ollama',
          'glm-5:cloud',
          null
        )
        toast.info('Default local profile created')
      }
    } catch (e) {
      console.error('Failed to create default profile', e)
    } finally {
      setSaving(false)
      setStep('platform')
    }
  }

  const handleStartConversation = async () => {
    setOnboardingComplete(true)
    if (defaultProfile) {
      try {
        const id = await createConversation.mutateAsync({})
        setActiveConversation(id)
      } catch (_err) {
        toast.error('Failed to create conversation')
      }
    }
  }

  const handleManageProfiles = () => {
    setOnboardingComplete(true)
    router.navigate({ to: '/settings/profiles' })
  }

  const handleBrowseSkills = () => {
    setOnboardingComplete(true)
    setRightTab('skills')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
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
              onSkip={handleApiKeySkip}
              saving={saving}
            />
          )}
          {step === 'platform' && (
            <PlatformStep
              email={email}
              onChange={setEmail}
              onNext={savePlatformEmail}
              onSkip={() => {
                setPlatformFeaturesEnabled(false)
                setStep('done')
              }}
              saving={saving}
            />
          )}
          {step === 'done' && (
            <DoneStep
              onStartConversation={handleStartConversation}
              onManageProfiles={handleManageProfiles}
              onBrowseSkills={handleBrowseSkills}
            />
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
          Build, share, and control AI workflows—
          <strong>without the cloud</strong>. Your code never leaves your
          machine, and your skills are version‑controlled like any other dev
          artifact.
        </p>
      </div>
      <div className="grid gap-3 text-left">
        {[
          {
            icon: <Shield size={16} className="text-emerald-500" />,
            title: 'Your data stays local',
            desc: 'API keys live in your OS keychain; conversations never leave your device.'
          },
          {
            icon: <Key size={16} className="text-blue-500" />,
            title: 'Skills are code',
            desc: 'Version‑controlled, shareable as Gists, and composable like any other dev tool.'
          },
          {
            icon: <Rocket size={16} className="text-violet-500" />,
            title: 'From chat to intelligence',
            desc: 'Orchestrate multi‑agent workflows with parallel execution and evaluator‑optimizer patterns.'
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
        type="button"
        onClick={onNext}
        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90"
      >
        Deal me in <ArrowRight size={16} />
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
        <h2 className="text-xl font-bold mb-1">
          Connect your first AI provider
        </h2>
        <p className="text-sm text-muted-foreground">
          SkillDeck needs an API key to chat with models. Start with Claude
          (Anthropic) – you can add more providers later in Settings.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="api-key" className="text-sm font-medium">
          Anthropic API Key
        </label>
        <input
          id="api-key"
          type="password"
          placeholder="sk-ant-…"
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Stored encrypted in your OS keychain — we never see it, and it never
          touches the cloud.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          I'll do this later
        </button>
        <button
          type="button"
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
        <h2 className="text-xl font-bold mb-1">
          Join the SkillDeck community (optional)
        </h2>
        <p className="text-sm text-muted-foreground">
          Get weekly skill‑sharing tips, referral rewards, and product updates
          that matter to developers. No spam – unsubscribe anytime.
        </p>
      </div>

      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
        <p className="font-medium mb-2">
          What you'll get by enabling platform features:
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
          <li>Sync skills from the community registry</li>
          <li>Share your skills as GitHub Gists</li>
          <li>Get team nudges and referral rewards</li>
          <li>
            Your code and API keys <strong>always stay local</strong> – we only
            sync skill metadata.
          </li>
        </ul>
      </div>

      <div className="flex gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
        <Mail size={18} className="text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">What you'll get:</p>
          <ul className="mt-1 text-muted-foreground space-y-0.5 text-xs list-none">
            <li>• Curated tips to supercharge your team's AI workflows</li>
            <li>• Early access to new features and referral rewards</li>
            <li>• A direct line to the team (we read every email)</li>
          </ul>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@yourteam.com"
          value={email}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            'Saving…'
          ) : email ? (
            <>
              <span>Save & continue</span> <ArrowRight size={14} />
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

function DoneStep({
  onStartConversation,
  onManageProfiles,
  onBrowseSkills
}: {
  onStartConversation: () => void
  onManageProfiles: () => void
  onBrowseSkills: () => void
}) {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
        <Check size={28} className="text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-2">You're ready to deal!</h2>
        <p className="text-sm text-muted-foreground">
          Your deck is assembled. Start a conversation, explore the skill
          marketplace, or build your first multi‑agent workflow.
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={onStartConversation}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
        >
          Start a conversation
        </button>
        <button
          type="button"
          onClick={onManageProfiles}
          className="w-full py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          Manage profiles
        </button>
        <button
          type="button"
          onClick={onBrowseSkills}
          className="w-full py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          Browse skills
        </button>
      </div>
    </div>
  )
}
