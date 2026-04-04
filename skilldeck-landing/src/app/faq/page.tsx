import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { FAQSection } from '@/components/sections/FAQSection'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about SkillDeck. Learn about local data storage, API key security, the Skill system, MCP protocol, and more.',
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
