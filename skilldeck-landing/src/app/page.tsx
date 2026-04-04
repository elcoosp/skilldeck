'use client'

import { Hero } from '@/components/sections/Hero'
import { FeatureBelt } from '@/components/sections/FeatureBelt'
import { FeatureAgentSystem } from '@/components/sections/FeatureAgentSystem'
import { FeatureSkillsMCP } from '@/components/sections/FeatureSkillsMCP'
import { FeatureWorkflows } from '@/components/sections/FeatureWorkflows'
import { FeatureConversations } from '@/components/sections/FeatureConversations'
import { FeaturePrivacy } from '@/components/sections/FeaturePrivacy'
import { ComparisonTable } from '@/components/sections/ComparisonTable'
import { HowItWorks } from '@/components/sections/HowItWorks'
import { CodeDemo } from '@/components/sections/CodeDemo'
import { OpenSourceCTA } from '@/components/sections/OpenSourceCTA'
import { FAQSection } from '@/components/sections/FAQSection'
import { WaitlistSection } from '@/components/sections/WaitlistSection'
import { Header } from '@/components/shared/Header'
import { Footer } from '@/components/shared/Footer'

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <FeatureBelt />
        <FeatureAgentSystem />
        <FeatureSkillsMCP />
        <FeatureWorkflows />
        <FeatureConversations />
        <FeaturePrivacy />
        <CodeDemo />
        <ComparisonTable />
        <HowItWorks />
        <OpenSourceCTA />
        <FAQSection />
        <WaitlistSection />
      </main>
      <Footer />
    </>
  )
}
