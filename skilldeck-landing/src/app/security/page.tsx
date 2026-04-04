import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'

export const metadata: Metadata = {
  title: 'Security',
  description: 'SkillDeck security policy. Learn about local data encryption, API key storage, the Tool Approval Gate, and our approach to secure AI development.',
}

export default function SecurityPage() {
  return (
    <PageLayout>
      <div className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Security Policy</h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: January 15, 2025</p>

          <div className="prose prose-invert prose-slate max-w-none space-y-8 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Architecture</h2>
              <p>
                SkillDeck is built with a Rust core (Tauri 2) for the backend engine and a React frontend
                for the interface. The Rust core handles all sensitive operations including API key management,
                data storage, and process execution. This provides memory safety guarantees that prevent entire
                classes of vulnerabilities common in C/C++ and other systems languages.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">API Key Storage</h2>
              <p>
                API keys are stored exclusively in your operating system&apos;s native keychain:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3">
                <li>macOS: Keychain Services</li>
                <li>Windows: Windows Credential Manager</li>
                <li>Linux: Freedesktop Secret Service (GNOME Keyring / KWallet)</li>
              </ul>
              <p className="mt-3">
                API keys are never written to the SQLite database, never stored in configuration files in
                plaintext, and never transmitted except directly to the intended API endpoint. The codebase
                includes explicit security tests that verify this behavior.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Tool Approval Gate</h2>
              <p>
                The Tool Approval Gate is your primary security control for AI agent actions. When an agent
                attempts to call any external tool (through MCP or a skill), execution pauses and the full
                request is presented to you. You can:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3">
                <li>Approve the request as-is</li>
                <li>Edit the input parameters before approving</li>
                <li>Deny the request entirely</li>
              </ul>
              <p className="mt-3">
                Six auto-approve categories are available for convenience (reads, writes, selects, mutations,
                HTTP requests, shell commands), but every single one is off by default. This ensures maximum
                security out of the box.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Skill Linter Security</h2>
              <p>
                The Skill Linter runs 17 validation rules including dedicated security checks that detect:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3">
                <li>Shell injection patterns (rm -rf, fork bombs, curl | sh chains)</li>
                <li>Unmatched tool declarations that could bypass the approval gate</li>
                <li>Symlinked skill directories to prevent path traversal attacks</li>
                <li>Excessively large skill files that could cause memory issues</li>
              </ul>
              <p className="mt-3">
                Each skill receives a security score on a 1-5 scale, allowing you to evaluate third-party
                skills before loading them into your agent context.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Local Data Isolation</h2>
              <p>
                All data is stored in a local SQLite database with no external network access. The database
                file is subject to your operating system&apos;s file permissions. SkillDeck does not open
                any network listeners by default.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Reporting Vulnerabilities</h2>
              <p>
                If you discover a security vulnerability in SkillDeck, please report it responsibly by opening
                a private issue on GitHub or contacting the maintainers directly. We will acknowledge receipt
                within 48 hours and aim to resolve critical issues within 7 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Open Source Auditability</h2>
              <p>
                SkillDeck is fully open source under the MIT License. Every security
                mechanism described here can be verified by auditing the source code. We encourage security
                researchers and users to review the codebase and contribute to our security posture.
              </p>
            </section>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
