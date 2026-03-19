// src/components/overlays/onboarding-wizard.tsx
import { ArrowRight, Check, Key, Mail, Rocket, Shield } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { commands } from '@/lib/bindings'
import {
  ensurePlatformRegistration,
  updatePlatformPreferences
} from '@/lib/platform'
import { useUIStore } from '@/store/ui'
import { useCreateConversation } from '@/hooks/use-conversations'
import { useProfiles } from '@/hooks/use-profiles'

type Step = 'welcome' | 'apikey' | 'platform' | 'done'

export function OnboardingWizard() {
  const onboardingComplete = useUIStore((s) => s.onboardingComplete)
  const setOnboardingComplete = useUIStore((s) => s.setOnboardingComplete)
  const setPlatformFeaturesEnabled = useUIStore(
    (s) => s.setPlatformFeaturesEnabled
  )
  const setActiveConversation = useUIStore((s) => s.setActiveConversation)
  const setRightTab = useUIStore((s) => s.setRightTab)

  const [step, setStep] = useState<Step>('welcome')
  const [email, setEmail] = useState('')
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: profiles } = useProfiles()
  const defaultProfile = profiles?.find(p => p.is_default) ?? profiles?.[0]
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
      const profilesRes = await commands.listProfiles()
      if (profilesRes.status === 'ok' && profilesRes.data.length === 0) {
        await commands.createProfile('Local (Ollama)', 'ollama', 'glm-5:cloud')
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
      } catch (err) {
        toast.error('Failed to create conversation')
      }
    }
  }

  const handleManageProfiles = () => {
    setOnboardingComplete(true)
    window.dispatchEvent(new CustomEvent('skilldeck:open-settings', { detail: { tab: 'profiles' } }))
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

// ... (WelcomeStep, ApiKeyStep, PlatformStep unchanged, omitted for brevity)

function DoneStep({ onStartConversation, onManageProfiles, onBrowseSkills }: {
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
