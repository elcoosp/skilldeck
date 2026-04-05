import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { getChangelogContent } from '@/lib/changelog'

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'SkillDeck changelog. See what is new in each release.'
}

export default function ChangelogPage() {
  const content = getChangelogContent()

  return (
    <PageLayout>
      <div className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Changelog</h1>
          <p className="text-lg text-muted-foreground mb-12">
            All notable changes to SkillDeck are documented here.
          </p>

          <div className="prose prose-invert prose-slate max-w-none">
            {content ? (
              <div className="space-y-6 text-muted-foreground leading-relaxed whitespace-pre-line">
                {content.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) {
                    return (
                      <h2
                        key={i}
                        className="text-2xl font-bold text-foreground mt-10 mb-4"
                      >
                        {line.replace('## ', '')}
                      </h2>
                    )
                  }
                  if (line.startsWith('### ')) {
                    return (
                      <h3
                        key={i}
                        className="text-lg font-semibold text-foreground mt-6 mb-2"
                      >
                        {line.replace('### ', '')}
                      </h3>
                    )
                  }
                  if (line.startsWith('- ')) {
                    return (
                      <li key={i} className="ml-4">
                        {line.replace('- ', '')}
                      </li>
                    )
                  }
                  if (line.trim() === '') return <br key={i} />
                  return <p key={i}>{line}</p>
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Changelog content not available yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
