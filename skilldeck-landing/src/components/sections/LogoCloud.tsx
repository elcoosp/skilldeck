'use client'

import { Brain, Sparkles, Cpu, Plug } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'

function ProviderCard({ name, icon: Icon, desc, iconColor }: { name: string; icon: React.ComponentType<{ className?: string }>; desc: string; iconColor: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-300 cursor-default h-full overflow-hidden">
      <div className={`w-10 h-10 rounded-lg bg-card flex items-center justify-center shrink-0`}><Icon className={`w-5 h-5 ${iconColor}`} /></div>
      <div className="min-w-0">
        <p className="font-semibold text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
    </div>
  )
}

export function LogoCloud() {
  const { t } = useLingui()

  const providers = [
    { name: 'OpenAI', icon: Brain, desc: 'GPT-4o, GPT-4, GPT-3.5', iconColor: 'text-emerald-500' },
    { name: 'Claude', icon: Sparkles, desc: 'Claude 3.5 Sonnet, Opus', iconColor: 'text-blue-500' },
    { name: 'Ollama', icon: Cpu, desc: 'Llama, Mistral, Gemma', iconColor: 'text-sky-500' },
    { name: 'MCP Protocol', icon: Plug, desc: t`Model Context Protocol`, iconColor: 'text-[#ff8a4c]' },
  ]

  return (
    <section className="py-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-muted-foreground mb-8">{t`Works with your favorite LLM providers`}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto items-stretch">
          {providers.map((provider) => (
            <ProviderCard key={provider.name} {...provider} />
          ))}
        </div>
      </div>
    </section>
  )
}
