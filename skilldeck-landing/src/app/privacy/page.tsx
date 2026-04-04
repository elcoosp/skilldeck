import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'SkillDeck privacy policy. Learn how SkillDeck handles your data -- locally, securely, and with zero cloud dependencies.',
}

export default function PrivacyPage() {
  return (
    <PageLayout>
      <div className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: January 15, 2025</p>

          <div className="prose prose-invert prose-slate max-w-none space-y-8 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Overview</h2>
              <p>
                SkillDeck is a local-first desktop application. All data processing, storage, and AI inference
                happen on your machine. SkillDeck does not collect, transmit, or store any personal data on
                external servers by default.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Data Storage</h2>
              <p>
                All conversations, messages, artifacts, workflow definitions, skill files, and usage analytics
                are stored exclusively in a local SQLite database on your machine. This database file resides
                in your application data directory and is fully under your control.
              </p>
              <p className="mt-3">
                API keys for LLM providers (OpenAI, Claude, etc.) are stored in your operating system&apos;s
                native keychain (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux).
                API keys are never written to the SQLite database or to any configuration file in plaintext.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Network Communication</h2>
              <p>
                SkillDeck communicates with external services only when you explicitly configure it to do so:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3">
                <li>OpenAI and Claude APIs receive only the prompts you explicitly send for AI completion.</li>
                <li>MCP servers communicate only with the servers you configure, using the transport type you specify.</li>
                <li>The optional SkillDeck Platform communicates only if you register and opt in to cloud features.</li>
              </ul>
              <p className="mt-3">
                When using Ollama for local model inference, SkillDeck requires no network connection whatsoever.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Optional Platform Services</h2>
              <p>
                The SkillDeck Platform provides optional features including skill registry access, user
                registration, referrals, and analytics. All platform features are opt-in. You can use
                SkillDeck fully without ever interacting with the platform.
              </p>
              <p className="mt-3">
                If you choose to use the platform, we collect only the information you provide during
                registration (email and display name) and basic usage analytics. Platform data is stored
                securely and can be deleted upon request.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Telemetry</h2>
              <p>
                SkillDeck does not include any telemetry, analytics, or tracking by default. The application
                does not phone home. No usage data, crash reports, or behavioral data are sent to any server
                without your explicit consent.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Open Source</h2>
              <p>
                SkillDeck is open source under the MIT License. You can audit every line
                of code to verify these privacy claims. The source code is available on GitHub.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Contact</h2>
              <p>
                If you have questions about this privacy policy or SkillDeck&apos;s data handling practices,
                please open an issue on GitHub or contact us through the project repository.
              </p>
            </section>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
