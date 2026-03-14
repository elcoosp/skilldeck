/**
 * OnboardingWizard — first-run modal guiding users through:
 *   Step 1: Welcome
 *   Step 2: API key setup (Claude / OpenAI) or Ollama
 *   Step 3: Create a default profile
 *   Step 4: Done
 *
 * Integrates with the existing invoke layer and settings commands.
 */

import { useState } from 'react'
import { Check, ChevronRight, Eye, EyeOff, Key, Layers, Loader2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { setApiKey, validateApiKey, createProfile } from '@/lib/invoke'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'welcome' | 'apikeys' | 'profile' | 'done'

const STEPS: Step[] = ['welcome', 'apikeys', 'profile', 'done']

// ── Root component ────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>('welcome')
  const setOnboardingComplete = useUIStore((s) => s.setOnboardingComplete)

  // Shared state lifted up so Profile step can read provider choice
  const [chosenProvider, setChosenProvider] = useState<string>('ollama')

  const next = () => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  const finish = () => setOnboardingComplete(true)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="Welcome to SkillDeck"
      >
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((STEPS.indexOf(step) + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {step === 'welcome' && <WelcomeStep onNext={next} />}
          {step === 'apikeys' && (
            <ApiKeysStep onNext={next} onProviderChosen={setChosenProvider} />
          )}
          {step === 'profile' && (
            <ProfileStep provider={chosenProvider} onNext={next} />
          )}
          {step === 'done' && <DoneStep onFinish={finish} />}
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 pb-6">
          {STEPS.map((s) => (
            <div
              key={s}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                s === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Welcome ───────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Zap className="size-8 text-primary" />
        </div>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Welcome to SkillDeck</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          A local-first AI orchestration platform. Your conversations, skills, and
          workflows stay on your machine — no cloud required.
        </p>
      </div>
      <ul className="text-left space-y-2 text-sm">
        {[
          { icon: Zap, text: 'Connect any AI provider — Claude, OpenAI, or local Ollama' },
          { icon: Layers, text: 'Load filesystem-based skills into any conversation' },
          { icon: Key, text: 'API keys stored in your OS keychain, never in the database' },
        ].map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-muted-foreground">
            <Icon className="size-4 text-primary shrink-0" />
            {text}
          </li>
        ))}
      </ul>
      <Button className="w-full" onClick={onNext}>
        Get started <ChevronRight className="ml-1 size-4" />
      </Button>
    </div>
  )
}

// ── Step 2: API Keys ──────────────────────────────────────────────────────────

const PROVIDERS = [
  { id: 'claude', label: 'Anthropic (Claude)', placeholder: 'sk-ant-…', description: 'Best quality, requires API key' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-…', description: 'GPT-4o and friends, requires API key' },
  { id: 'ollama', label: 'Ollama (local)', placeholder: 'optional token', description: 'Free, runs locally, no key needed' },
]

function ApiKeysStep({
  onNext,
  onProviderChosen,
}: {
  onNext: () => void
  onProviderChosen: (provider: string) => void
}) {
  const [selected, setSelected] = useState<string>('ollama')
  const [apiKey, setApiKeyValue] = useState('')
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedProvider = PROVIDERS.find((p) => p.id === selected)!
  const needsKey = selected !== 'ollama'

  const handleNext = async () => {
    if (needsKey && apiKey.trim()) {
      setSaving(true)
      try {
        const valid = await validateApiKey(selected, apiKey.trim())
        if (!valid) {
          toast.error('API key validation failed — please check and try again.')
          setSaving(false)
          return
        }
        await setApiKey(selected, apiKey.trim())
        toast.success(`${selectedProvider.label} key saved.`)
      } catch (err) {
        toast.error('Failed to save API key.')
        setSaving(false)
        return
      }
      setSaving(false)
    }
    onProviderChosen(selected)
    onNext()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Set up your AI provider</h2>
        <p className="text-sm text-muted-foreground">
          Choose how you want to power SkillDeck. You can add more providers later in Settings.
        </p>
      </div>

      {/* Provider cards */}
      <div className="space-y-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelected(p.id); setApiKeyValue('') }}
            className={cn(
              'w-full text-left p-3 rounded-lg border transition-colors',
              selected === p.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{p.label}</span>
              {selected === p.id && <Check className="size-4 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
          </button>
        ))}
      </div>

      {/* Key input for non-Ollama */}
      {needsKey && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {selectedProvider.label} API Key
          </label>
          <div className="relative">
            <Input
              type={visible ? 'text' : 'password'}
              placeholder={selectedProvider.placeholder}
              value={apiKey}
              onChange={(e) => setApiKeyValue(e.target.value)}
              className="pr-9 font-mono text-sm"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setVisible(!visible)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stored in your OS keychain — never in the database.
          </p>
        </div>
      )}

      {selected === 'ollama' && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          Make sure Ollama is running on port 11434. Download it at{' '}
          <span className="font-mono">ollama.com</span> if needed.
        </p>
      )}

      <Button
        className="w-full"
        onClick={handleNext}
        disabled={saving || (needsKey && !apiKey.trim())}
      >
        {saving ? (
          <><Loader2 className="mr-2 size-4 animate-spin" /> Validating…</>
        ) : needsKey && !apiKey.trim() ? (
          'Enter an API key to continue'
        ) : (
          <>{needsKey ? 'Save & continue' : 'Continue with Ollama'} <ChevronRight className="ml-1 size-4" /></>
        )}
      </Button>
      <button
        onClick={() => { onProviderChosen('ollama'); onNext() }}
        className="w-full text-xs text-muted-foreground hover:text-foreground text-center mt-1"
      >
        Skip for now
      </button>
    </div>
  )
}

// ── Step 3: Profile ───────────────────────────────────────────────────────────

const PROVIDER_MODELS: Record<string, string[]> = {
  claude: ['claude-sonnet-4-5', 'claude-opus-4', 'claude-3-5-sonnet'],
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  ollama: ['llama3.2:latest', 'mistral:latest', 'codellama:latest'],
}

function ProfileStep({ provider, onNext }: { provider: string; onNext: () => void }) {
  const models = PROVIDER_MODELS[provider] ?? PROVIDER_MODELS['ollama']
  const [name, setName] = useState('My Profile')
  const [modelId, setModelId] = useState(models[0])
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Profile name is required.'); return }
    setSaving(true)
    try {
      await createProfile(name.trim(), provider, modelId)
      toast.success('Profile created!')
      onNext()
    } catch (err) {
      toast.error('Failed to create profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Create your first profile</h2>
        <p className="text-sm text-muted-foreground">
          Profiles bundle a provider, model, and skills together. You can create more later.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Profile name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fast Coder, Research Mode"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Model
          </label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <Button className="w-full" onClick={handleCreate} disabled={saving || !name.trim()}>
        {saving ? <><Loader2 className="mr-2 size-4 animate-spin" /> Creating…</> : <>Create profile <ChevronRight className="ml-1 size-4" /></>}
      </Button>
      <button
        onClick={onNext}
        className="w-full text-xs text-muted-foreground hover:text-foreground text-center mt-1"
      >
        Skip — use default profile
      </button>
    </div>
  )
}

// ── Step 4: Done ──────────────────────────────────────────────────────────────

function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <Check className="size-8 text-green-500" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">You're all set!</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Start a new conversation, load skills from your filesystem, or connect MCP
          servers from the right panel. Everything stays local.
        </p>
      </div>
      <Button className="w-full" onClick={onFinish}>
        Open SkillDeck
      </Button>
    </div>
  )
}
