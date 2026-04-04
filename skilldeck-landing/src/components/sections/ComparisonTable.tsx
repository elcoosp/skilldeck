'use client'

import { Check, X } from 'lucide-react'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { useABTest } from '@/contexts/ABTestContext'
import { useLingui } from '@lingui/react/macro'

type RowData = {
  feature: string
  skilldeck: boolean
  cursor: boolean
  continue: boolean
  cline: boolean
}

function StatusIcon({ supported }: { supported: boolean }) {
  return supported ? (
    <Check className="w-4 h-4 text-emerald-500" />
  ) : (
    <X className="w-4 h-4 text-muted-foreground/50" />
  )
}

function MobileComparisonCards({ data, columns }: { data: readonly RowData[]; columns: { key: string; label: string; highlighted: boolean }[] }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {data.map((row) => (
        <div key={row.feature} className="bg-card border border-border rounded-xl p-3 sm:p-4">
          <p className="text-xs sm:text-sm font-medium text-foreground mb-2.5 sm:mb-3 leading-snug">{row.feature}</p>
          <div className="grid grid-cols-2 gap-2">
            {columns.map((col) => (
              <div key={col.key} className="flex items-center gap-1.5">
                <StatusIcon supported={row[col.key as keyof RowData] as boolean} />
                <span className={`text-xs truncate ${col.highlighted ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {col.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ComparisonTable() {
  const { t } = useLingui()
  const { getVariant } = useABTest()
  const headingVariant = getVariant('comparison_heading') ?? 'persuasive'

  const title = headingVariant === 'persuasive'
    ? t`Why developers are switching to SkillDeck`
    : t`How SkillDeck compares`

  const description = headingVariant === 'persuasive'
    ? t`A feature-by-feature breakdown against the tools you're probably using right now.`
    : t`A side-by-side look at what sets SkillDeck apart from other AI developer tools.`

  const columns = [
    { key: 'skilldeck', label: 'SkillDeck', highlighted: true },
    { key: 'cursor', label: 'Cursor', highlighted: false },
    { key: 'continue', label: 'Continue', highlighted: false },
    { key: 'cline', label: 'Cline', highlighted: false },
  ]

  const comparisonData: RowData[] = [
    { feature: t`Multi-provider support (OpenAI, Claude, Ollama)`, skilldeck: true, cursor: false, continue: false, cline: false },
    { feature: t`Local model support (full Ollama, works offline)`, skilldeck: true, cursor: false, continue: false, cline: false },
    { feature: t`Skill system with linting, registry, and sharing`, skilldeck: true, cursor: false, continue: false, cline: false },
    { feature: t`Visual workflow editor (3 execution patterns)`, skilldeck: true, cursor: false, continue: false, cline: false },
    { feature: t`Multi-agent orchestration with parallel subagents`, skilldeck: true, cursor: false, continue: false, cline: false },
    { feature: t`Full MCP protocol (stdio + SSE, supervisor)`, skilldeck: true, cursor: false, continue: false, cline: false },
    { feature: t`Tool Approval Gate (category-based, off by default)`, skilldeck: true, cursor: false, continue: false, cline: false },
    { feature: t`Conversation branching from any message`, skilldeck: true, cursor: false, continue: false, cline: false },
    { feature: t`Multiple LLM providers`, skilldeck: true, cursor: true, continue: true, cline: true },
    { feature: t`Open source (MIT)`, skilldeck: true, cursor: false, continue: true, cline: true },
    { feature: t`100% local data storage, OS keychain for keys`, skilldeck: true, cursor: false, continue: false, cline: false },
    { feature: t`Native desktop (Tauri, not Electron)`, skilldeck: true, cursor: false, continue: false, cline: false },
  ]

  return (
    <section className="py-28 relative" id="compare">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title={title} description={description} />
        <div className="mt-12">
          <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden" style={{ contentVisibility: 'auto' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4 lg:px-6 text-muted-foreground font-medium">{t`Feature`}</th>
                    {columns.map((col) => (
                      <th key={col.key} className={`py-4 px-4 lg:px-6 text-center font-semibold whitespace-nowrap ${col.highlighted ? 'text-primary bg-blue-500/5' : 'text-muted-foreground'}`}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, idx) => (
                    <tr key={row.feature} className={`border-b border-border/50 last:border-0 hover:bg-white/[0.02] transition-colors ${idx % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                      <td className="py-3.5 px-4 lg:px-6 text-foreground font-medium">{row.feature}</td>
                      <td className="py-3.5 px-4 lg:px-6 bg-blue-500/5"><div className="flex items-center justify-center"><StatusIcon supported={row.skilldeck} /></div></td>
                      <td className="py-3.5 px-4 lg:px-6"><div className="flex items-center justify-center"><StatusIcon supported={row.cursor} /></div></td>
                      <td className="py-3.5 px-4 lg:px-6"><div className="flex items-center justify-center"><StatusIcon supported={row.continue} /></div></td>
                      <td className="py-3.5 px-4 lg:px-6"><div className="flex items-center justify-center"><StatusIcon supported={row.cline} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <MobileComparisonCards data={comparisonData} columns={columns} />
        </div>
      </div>
    </section>
  )
}
