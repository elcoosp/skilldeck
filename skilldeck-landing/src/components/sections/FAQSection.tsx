'use client'

import { useLingui } from '@lingui/react/macro'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion'

export function FAQSection() {
	const { t } = useLingui()

	const faqItems = [
		{
			question: t`Does my code ever leave my machine?`,
			answer: t`No. All conversations, artifacts, and workflow executions are stored in a local SQLite database. When you use OpenAI or Claude, only the prompts you explicitly send reach those APIs. When you use Ollama, everything stays on your machine entirely.`,
		},
		{
			question: t`Where are my API keys stored?`,
			answer: t`In your operating system's native keychain (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux). They are never written to the database or to any configuration file in plaintext. This is verified by automated security tests in the codebase.`,
		},
		{
			question: t`What is the Skill system?`,
			answer: t`Skills are Markdown-based AI instruction packages. Each skill is a directory containing a SKILL.md file with YAML frontmatter that declares the skill name, description, compatible models, and allowed tools. Skills are injected into the agent's system prompt to guide its behavior for specific tasks.`,
		},
		{
			question: t`Can I use my own local models?`,
			answer: t`Yes. SkillDeck detects any model installed through Ollama and makes it available as a provider option. You can run SkillDeck fully offline with no network connection whatsoever.`,
		},
		{
			question: t`What is MCP and why does it matter?`,
			answer: t`MCP (Model Context Protocol) is an open standard for connecting AI agents to external tools and data sources. SkillDeck implements the full protocol with stdio and SSE transports, so you can plug in any MCP-compatible server and give agents access to file systems, databases, APIs, and more — without writing glue code.`,
		},
		{
			question: t`How do the workflows work?`,
			answer: t`The Workflow Editor is a visual drag-and-drop canvas where you define steps, draw dependency edges, and assign skills. Pick an execution pattern — Sequential for ordered pipelines, Parallel for concurrent steps, or Evaluator-Optimizer for iterative refinement. The graph engine computes the correct execution order and runs your workflow with live status updates.`,
		},
		{
			question: t`Is the platform backend required?`,
			answer: t`No. The SkillDeck Platform is entirely optional. It provides features like the skill registry, referrals, and analytics — but the desktop app works fully without it. Registration is opt-in, and you can delete your account at any time.`,
		},
		{
			question: t`How does the tool approval gate work?`,
			answer: t`When an agent calls an external tool through MCP or a skill, execution pauses and the request appears in the conversation. You can approve it as-is, edit the input before it runs, or deny it entirely. Six auto-approve categories exist for convenience, but every single one is off by default.`,
		},
		{
			question: t`What does the Skill Linter check?`,
			answer: t`17 rules across four categories. Frontmatter rules validate required fields and formatting. Structure rules check file existence, size limits, and nesting depth. Security rules detect dangerous patterns like shell injections and unmatched tool declarations. Quality rules check for examples, structured instructions, and content clarity.`,
		},
		{
			question: t`Can I use SkillDeck with any text editor?`,
			answer: t`Yes. SkillDeck is a standalone desktop application, not a plugin or extension. It works alongside VS Code, Neovim, JetBrains, or any editor and IDE you prefer.`,
		},
	]

	return (
		<section className="pt-24 pb-32 relative">
			<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="text-center max-w-3xl mx-auto">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
						{t`Questions developers`} <span className="gradient-text">{t`actually ask`}</span>
					</h2>
					<p className="mt-4 text-lg text-muted-foreground leading-relaxed">{t`The answers to the things you're wondering about right now.`}</p>
				</div>
				<div className="mt-12" style={{ contentVisibility: 'auto' }}>
					<Accordion type="single" collapsible className="w-full">
						{faqItems.map((item, idx) => (
							<AccordionItem key={idx} value={`faq-${idx}`} className="border-border">
								<AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline transition-colors">
									{item.question}
								</AccordionTrigger>
								<AccordionContent className="text-muted-foreground leading-relaxed">
									{item.answer}
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</div>
			</div>
		</section>
	)
}
