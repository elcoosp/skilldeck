'use client'

import { Download, Plug, Rocket, ChevronRight } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'

function StepCard({ number, icon: Icon, title, description, color, bgColor, borderColor, isLast }: {
  number: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string; color: string; bgColor: string; borderColor: string; isLast: boolean
}) {
  return (
    <div className="relative">
      <div className={`bg-card border border-border rounded-2xl p-6 lg:p-8 ${borderColor} hover:border-opacity-50 transition-all duration-300`}>
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center`}><Icon className={`w-6 h-6 ${color}`} /></div>
          <span className="text-3xl font-bold text-muted-foreground/20">{number}</span>
        </div>
        <h3 className="text-xl font-bold text-foreground mb-3">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {isLast ? null : (
        <div className="hidden lg:flex items-center justify-center absolute -right-8 top-1/2 -translate-y-1/2">
          <ChevronRight className="w-5 h-5 text-border" />
        </div>
      )}
    </div>
  )
}

export function HowItWorks() {
  const { t } = useLingui()

  const steps = [
    { number: '01', icon: Download, title: t`Download and set up`, description: t`Install the native app for your platform. The onboarding wizard walks you through provider setup in under a minute. No account needed — pick Ollama for fully local, or add OpenAI and Claude API keys stored in your OS keychain.`, color: 'text-primary', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
    { number: '02', icon: Plug, title: t`Add your tools and skills`, description: t`Browse the MCP Catalog to connect external tool servers, or add your own via stdio and SSE. Install community-built skills from the Marketplace, or create your own from a Markdown file with YAML frontmatter.`, color: 'text-[#ff8a4c]', bgColor: 'bg-[#ff8a4c]/10', borderColor: 'border-[#ff8a4c]/20' },
    { number: '03', icon: Rocket, title: t`Orchestrate and ship`, description: t`Design multi-step AI pipelines on the visual workflow editor. Equip agents with skills, spawn parallel subagents for independent tasks, and track every step in real time. Three execution patterns — Sequential, Parallel, Evaluator-Optimizer.`, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
  ]

  return (
    <section className="py-20 relative" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl"><span className="gradient-blue">{t`Up and running`}</span> {t`in three steps`}</h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{t`From download to your first AI workflow — no cloud account, no config files, no credit card.`}</p>
        </div>
        <div className="mt-16 grid md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step, idx) => (
            <StepCard key={step.number} {...step} isLast={idx === steps.length - 1} />
          ))}
        </div>
      </div>
    </section>
  )
}
