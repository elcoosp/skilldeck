'use client'

import { useLingui } from '@lingui/react/macro'
import { GitFork, Github, Star, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

function useGitHubStats() {
  const [stars, setStars] = useState<number | null>(null)
  const [forks, setForks] = useState<number | null>(null)
  useEffect(() => {
    fetch('https://api.github.com/repos/elcoosp/skilldeck')
      .then((res) => res.json())
      .then((data) => {
        setStars(data.stargazers_count ?? 0)
        setForks(data.forks_count ?? 0)
      })
      .catch(() => {})
  }, [])
  return { stars, forks }
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

export function OpenSourceCTA() {
  const { t } = useLingui()
  const { stars, forks } = useGitHubStats()

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 via-blue-400/5 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-blue-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
          {t`Free and open source —`}{' '}
          <span className="gradient-text">{t`forever`}</span>.
        </h2>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {t`Every feature ships under MIT — the agent loop, workflow engine, skill system, MCP supervisor, conversation branching. Audit the code, fork it, make it yours.`}
        </p>
        <div className="mt-10 flex items-center justify-center gap-8 sm:gap-12">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            <span className="text-2xl font-bold text-foreground">
              {stars !== null ? formatNumber(stars) : '---'}
            </span>
            <span className="text-sm text-muted-foreground">{t`stars`}</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-muted-foreground" />
            <span className="text-2xl font-bold text-foreground">
              {forks !== null ? formatNumber(forks) : '---'}
            </span>
            <span className="text-sm text-muted-foreground">{t`forks`}</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold text-foreground">MIT</span>
            <span className="text-sm text-muted-foreground">{t`license`}</span>
          </div>
        </div>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 text-white border-0 shadow-xl shadow-blue-500/25 text-base px-8"
            asChild
          >
            <a
              href="https://github.com/elcoosp/skilldeck"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="w-5 h-5 mr-2" />
              {t`Star on GitHub`}
            </a>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="border-border hover:bg-white/5 text-foreground text-base px-8"
            asChild
          >
            <a
              href="https://github.com/elcoosp/skilldeck/fork"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitFork className="w-5 h-5 mr-2" />
              {t`Fork & Contribute`}
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
