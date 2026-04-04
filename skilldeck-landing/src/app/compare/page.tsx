import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { ComparisonTable } from '@/components/sections/ComparisonTable'

export const metadata: Metadata = {
  title: 'Compare',
  description: 'A side-by-side comparison of SkillDeck with other AI developer tools. See how SkillDeck stacks up against Cursor, Continue, and Cline.',
}

export default function ComparePage() {
  return (
    <PageLayout>
      <div className="py-16">
        <ComparisonTable />
      </div>
    </PageLayout>
  )
}
