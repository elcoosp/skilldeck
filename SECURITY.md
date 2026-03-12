# Security Policy

## Supported Versions

We release patches for security vulnerabilities. The following versions are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | ✅ Yes             |
| < 1.0   | ❌ No (development) |

## Reporting a Vulnerability

We take the security of SkillDeck seriously. If you believe you have found a security vulnerability, please **do not** report it in a public GitHub issue. Instead, send a description of the issue to [security@skilldeck.dev](mailto:security@skilldeck.dev).

Please include as much of the following information as possible:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

We will acknowledge your email within 48 hours, and will send a more detailed response within 5 business days indicating the next steps in handling your report.

After the initial reply to your report, we will keep you informed of the progress towards a fix and full announcement, and may ask for additional information or guidance.

## Security-Related Configuration

### API Key Storage
SkillDeck stores API keys **exclusively in the OS keychain** (macOS Keychain, Windows Credential Manager, Linux libsecret). Keys are never stored in the database, configuration files, or logs. If the keychain is unavailable, the application will refuse to store new keys and display an error.

### Telemetry
SkillDeck does **not** collect any telemetry or usage data without explicit user opt-in. Telemetry is disabled by default. When enabled, it sends only anonymized usage statistics (feature usage, error counts) – no personal data, conversation content, or code.

### Tool Approval
By default, all tool calls that access external resources (file system, network, databases) require explicit user approval via an approval card. Users can configure auto‑approval for specific categories (file reads, database selects, etc.) in Settings.

### Symlink Safety
The skill scanner skips symlinked directories to prevent directory traversal attacks. Any attempt to scan a symlink is logged as a warning.

### TLS
All external HTTPS connections (to model providers, MCP servers) use TLS 1.2 or higher. Connections to servers that only support older TLS versions are rejected.

## Responsible Disclosure

We kindly ask that you follow responsible disclosure practices. Please give us a reasonable amount of time to fix the issue before publicizing it. We will coordinate public disclosure with you once a fix is available.

Thank you for helping keep SkillDeck and its users safe!
