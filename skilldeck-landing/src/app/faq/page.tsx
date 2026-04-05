import type { Metadata } from 'next'
import { FAQSection } from '@/components/sections/FAQSection'
import { PageLayout } from '@/components/shared/PageLayout'

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Frequently asked questions about SkillDeck. Learn about local data storage, API key security, the Skill system, MCP protocol, and more.'
}

export default function FAQPage() {
  return (
    <PageLayout>
      <div className="py-16">
        <FAQSection />
      </div>
    </PageLayout>
  )
}
