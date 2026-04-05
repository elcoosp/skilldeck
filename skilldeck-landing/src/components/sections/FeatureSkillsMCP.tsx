'use client'

import { useLingui } from '@lingui/react/macro'
import { Blocks, Cpu, FolderGit2, Plug, SearchCheck } from 'lucide-react'

function SkillCard({
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
    <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-all duration-300 cursor-default">
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

export function FeatureSkillsMCP() {
  const { t } = useLingui()

  const SKILLS = [
    {
      icon: Plug,
      title: t`Full MCP protocol`,
      description: t`Connect any MCP-compatible server through stdio or SSE transports. Give your agents access to external tools, databases, and APIs without writing glue code.`,
      color: 'text-primary',
      bgColor: 'bg-blue-500/10'
    },
    {
      icon: Blocks,
      title: t`Unified Skill Marketplace`,
      description: t`Browse community-built skills alongside your local collection. Bundle skills and MCP servers into profiles for different projects and workflows.`,
      color: 'text-[#ff8a4c]',
      bgColor: 'bg-[#ff8a4c]/10'
    },
    {
      icon: SearchCheck,
      title: t`17 built-in lint rules`,
      description: t`The Skill Linter checks frontmatter, file structure, security patterns, and content quality. Catches shell injections and dangerous patterns before they reach your agent.`,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      icon: FolderGit2,
      title: t`Markdown-based skills`,
      description: t`Each skill is a directory with YAML frontmatter — name, description, compatible models, allowed tools. Drop a folder, and it's ready. Changes hot-reload automatically.`,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10'
    }
  ] as const

  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Visual mockup */}
          <div className="order-2 lg:order-1">
            <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xl shadow-blue-500/5">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="text-xs text-muted-foreground ml-2">{t`SkillDeck — Skill Browser`}</span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{t`12 skills installed`}</span>
                </div>
              </div>
              {/* App body */}
              <div className="flex h-80">
                {/* Skill list sidebar */}
                <div className="w-48 border-r border-border bg-background/50 shrink-0 hidden sm:flex flex-col">
                  {/* Search bar */}
                  <div className="p-3 border-b border-border">
                    <div className="flex items-center gap-2 bg-card rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground">
                      <SearchCheck className="w-3 h-3" />
                      <span>{t`Search skills...`}</span>
                    </div>
                  </div>
                  {/* Skill list */}
                  <div className="flex-1 overflow-auto p-2 space-y-1">
                    <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-primary/10 text-xs">
                      <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Plug className="w-3 h-3 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-primary truncate">
                          mcp-github
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          v1.2.0
                        </p>
                      </div>
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-xs">
                      <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Blocks className="w-3 h-3 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          code-review
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          v2.0.1
                        </p>
                      </div>
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-xs">
                      <div className="w-5 h-5 rounded bg-amber-400/20 flex items-center justify-center shrink-0">
                        <FolderGit2 className="w-3 h-3 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          git-tools
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          v1.0.3
                        </p>
                      </div>
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-xs">
                      <div className="w-5 h-5 rounded bg-[#ff8a4c]/20 flex items-center justify-center shrink-0">
                        <Cpu className="w-3 h-3 text-[#ff8a4c]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          docker-manage
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          v0.9.0
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Detail panel */}
                <div className="flex-1 p-4 flex flex-col min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Plug className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        mcp-github
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by @skilldeck/community
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t`Connect to GitHub API through MCP. Create issues, manage PRs, search code, and interact with repositories directly from your agent workflows.`}</p>
                  {/* Details */}
                  <div className="space-y-2 text-xs mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t`Version`}</span>
                      <span className="text-foreground font-medium">1.2.0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t`MCP Servers`}</span>
                      <span className="text-foreground font-medium">
                        github
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t`Lint Status`}</span>
                      <span className="text-emerald-500 font-medium">{t`Passed (0 warnings)`}</span>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="mt-auto flex gap-2">
                    <div className="flex-1 text-center py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                      {t`Installed`}
                    </div>
                    <div className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground">
                      {t`Configure`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text content */}
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {t`Give your agents the right tools,`}
              <br />
              <span className="gradient-blue">{t`without the setup headache`}</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              {t`Markdown-based skill packages with built-in linting. Full MCP protocol support so you can connect any external tool in seconds.`}
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {SKILLS.map((skill) => (
                <SkillCard
                  key={skill.title}
                  icon={skill.icon}
                  title={skill.title}
                  description={skill.description}
                  color={skill.color}
                  bgColor={skill.bgColor}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
