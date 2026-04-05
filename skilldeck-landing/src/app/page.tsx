'use client'

import { CodeDemo } from '@/components/sections/CodeDemo'
import { ComparisonTable } from '@/components/sections/ComparisonTable'
import { FAQSection } from '@/components/sections/FAQSection'
import { FeatureAgentSystem } from '@/components/sections/FeatureAgentSystem'
import { FeatureBelt } from '@/components/sections/FeatureBelt'
import { FeatureConversations } from '@/components/sections/FeatureConversations'
import { FeaturePrivacy } from '@/components/sections/FeaturePrivacy'
import { FeatureSkillsMCP } from '@/components/sections/FeatureSkillsMCP'
import { FeatureWorkflows } from '@/components/sections/FeatureWorkflows'
import { Hero } from '@/components/sections/Hero'
import { HowItWorks } from '@/components/sections/HowItWorks'
import { OpenSourceCTA } from '@/components/sections/OpenSourceCTA'
import { WaitlistSection } from '@/components/sections/WaitlistSection'
import { Footer } from '@/components/shared/Footer'
import { Header } from '@/components/shared/Header'

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
