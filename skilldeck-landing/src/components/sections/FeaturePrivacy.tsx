'use client'

import { useLingui } from '@lingui/react/macro'
import { Database, Eye, Lock, Shield } from 'lucide-react'

function PrivacyCard({
  icon: Icon,
  title,
  description,
  color,
  bgColor
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  color: string
  bgColor: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-emerald-500/20 transition-all duration-300 cursor-default h-full">
      <div
        className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center mb-4`}
      >
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  )
}

export function FeaturePrivacy() {
  const { t } = useLingui()

  const PRIVACY_FEATURES = [
    {
      icon: Lock,
      title: t`OS keychain for API keys`,
      description: t`API keys live in your operating system's native keychain — never in the database, never in plaintext. Verified by automated security tests.`,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      icon: Database,
      title: t`100% local data storage`,
      description: t`Every conversation, message, artifact, and workflow definition lives in a local SQLite database on your machine. No server. No sync.`,
      color: 'text-[#ff8a4c]',
      bgColor: 'bg-[#ff8a4c]/10'
    },
    {
      icon: Eye,
      title: t`Tool Approval Gate`,
      description: t`Every external tool call pauses execution and shows you the request. Approve, edit the input, or deny it outright. Six auto-approve categories exist, all off by default.`,
      color: 'text-primary',
      bgColor: 'bg-blue-500/10'
    },
    {
      icon: Shield,
      title: t`Security-first Skill Linter`,
      description: t`17 lint rules catch dangerous patterns in skill content — shell injections, fork bombs, path traversal. Symlinked skill directories are rejected automatically.`,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10'
    }
  ] as const

  return (
    <section className="py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="gradient-text">{t`Your code. Your keys. Your control.`}</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            {t`Local-first by design. API keys in your OS keychain, a tool approval gate for every external call, and zero mandatory cloud services.`}
          </p>
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRIVACY_FEATURES.map((feature) => (
            <PrivacyCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              color={feature.color}
              bgColor={feature.bgColor}
            />
          ))}
        </div>

        {/* Trust banner */}
        <div className="mt-12 rounded-2xl p-6 lg:p-8 text-center bg-gradient-to-br from-emerald-500/10 via-card to-card border border-emerald-500/20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-500 text-sm font-medium mb-3">
            <Lock className="w-4 h-4" />
            {t`Privacy-First Architecture`}
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t`The SkillDeck Platform is entirely optional. Registration, the skill registry, referrals, and analytics are opt-in features.`}
            <br />
            {t`The desktop app works fully offline with local Ollama models and no network connection whatsoever.`}
          </p>
        </div>
      </div>
    </section>
  )
}
