# Skill Marketplace Feature Brainstorming (Refined – Hybrid Architecture + Open Standard Alignment)

**Session facilitated by:** Carson — Brainstorming Coach 🧠  
**Date:** 2026-03-15  
**Focus:** Platform‑side registry with LLM‑powered enrichment, cron‑based linting of changed skills only, client‑side linting via Tauri commands, full alignment with the open Agent Skills standard, and TOML‑based lint configuration with workspace overrides, plus a standalone CLI tool for manual validation.

---

## 🏗️ Architecture Overview

We adopt a **hybrid model** where the central platform handles aggregation, enrichment, and curation of public skills, while the client app (Tauri) provides instant linting for local skills (workspace, personal) and integrates with the platform for discovery.

```
┌─────────────────┐         ┌─────────────────┐
│   SkillDeck     │         │   Marketplace   │
│   Client (Tauri)│◄────────│   Platform      │
│                 │  API     │                 │
└────────┬────────┘         └────────┬────────┘
         │                            │
         │ (local lint)               │ (cron lint + LLM)
         ▼                            ▼
┌─────────────────┐         ┌─────────────────┐
│  Linting Crate  │         │  Linting Crate  │
│   (skilldeck-lint)         (skilldeck-lint) │
└─────────────────┘         └─────────────────┘
```

- **Linting crate** (`skilldeck-lint`) is a standalone Rust crate containing all lint rules. It is used **both** on the client (via Tauri commands) and on the platform (in background cron jobs). This ensures consistent lint results everywhere.
- **Platform** responsibilities:
  - Crawling and indexing public skill sources (GitHub, GitLab, npm, etc.).
  - Running LLM‑based auto‑categorization and metadata extraction (Ollama GLM5 cloud).
  - Running periodic linting on **only changed skills** (using content hash) and storing results.
  - Exposing a registry API for clients.
- **Client** responsibilities:
  - Managing local skills (workspace `./.skilldeck/skills/`, personal `~/.agents/skills/`).
  - Providing Tauri commands to lint any skill on demand.
  - Fetching and caching the central registry.
  - Combining local and remote skills in the UI.
  - Applying lint preferences from TOML configuration (global + workspace).

---

## 📦 Source Integration – Platform Side

The platform ingests skills from multiple public sources.

| Idea | Description |
|------|-------------|
| **Federated ingestion** | Periodically crawl GitHub, GitLab, npm, and direct Git repositories that are registered or discovered via search. |
| **Author submission** | Skill authors submit their repo via a web form; platform validates and indexes it. |
| **Manual curation** | Moderators can feature skills, assign verified badges, and override categories. |
| **Version tracking** | Store each version (by commit hash) with content hash; allow rollback and diffing. |
| **Metadata extraction** | Parse `SKILL.md` frontmatter for `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. |
| **Content hash** | Compute a SHA‑256 hash of the skill’s `SKILL.md` content (excluding frontmatter?) to detect changes. |

---

## 🤖 LLM Auto‑Categorization & Metadata Enrichment (Platform)

After ingestion, the platform uses an LLM (Ollama GLM5 cloud) to enrich skill metadata beyond what’s explicitly provided in frontmatter. This enrichment is stored in the platform database and exposed via the API.

| Enrichment Type | Description | Example |
|-----------------|-------------|---------|
| **Tags** | Generate relevant tags based on skill content, description, and examples. | `["python", "data-cleaning", "csv"]` |
| **Primary category** | Assign a high‑level category (e.g., “Development”, “Data Science”, “Writing”). | `"Data Science"` |
| **Language/framework detection** | Detect programming languages, frameworks, or tools mentioned. | `"Python 3.10+", "pandas"` |
| **Dependencies** | Extract required external tools or libraries (e.g., `git`, `docker`, `jq`). | `{"python": ["pandas"], "system": ["git"]}` |
| **Compatibility hints** | Infer environment needs from content (e.g., “Requires Node.js 18+”). | `"Node.js >= 18"` |
| **License type** | Normalize license string (e.g., “MIT”, “Apache‑2.0”) if present. | `"MIT"` |
| **Author/org** | Extract from frontmatter `metadata.author` or infer from repository. | `"example-org"` |
| **Version** | Extract version from `metadata.version` or infer from Git tag. | `"1.2.3"` |
| **Required tools** | Parse `allowed-tools` field (experimental) and expand. | `["Bash(git:*)", "Read"]` |
| **Domain** | Broader domain (e.g., “web development”, “finance”). | `"web development"` |
| **Complexity** | Estimate skill complexity (simple, moderate, complex) based on length and structure. | `"moderate"` |
| **Use case examples** | Extract example prompts from content. | `"Analyze this CSV file"` |
| **Quality indicators** | Rate clarity, completeness, and presence of examples (1‑5). | `4` |
| **Embeddings** | Compute vector embedding of skill content for similarity search and recommendations. | `[0.12, -0.34, …]` |

All LLM outputs are cached and only regenerated when the skill content changes (detected via content hash).

---

## 🧹 Cron‑Based Linting (Platform – Changed Skills Only)

A background job runs periodically (e.g., every hour) to lint skills that have changed since the last run. It uses the same `skilldeck-lint` crate that the client uses.

| Feature | Description |
|---------|-------------|
| **Change detection** | Each skill record in the platform DB stores the last content hash and the last lint timestamp. The cron job queries for skills where `content_hash != last_linted_hash` OR `updated_at > last_linted_at`. |
| **Incremental scanning** | Only changed skills are processed, minimizing LLM and compute costs. |
| **Lint rules** | Rules are defined in `skilldeck-lint` (see below). |
| **Result storage** | Lint warnings are stored per skill version, with severity levels (`info`, `warning`, `error`). |
| **Lint versioning** | When lint rules are updated, all skills can be re‑evaluated on‑demand (by clearing last lint timestamps). |
| **Expose via API** | Client fetches lint results along with skill metadata. |

---

## 🧪 Linting Rules (`skilldeck-lint` crate)

The lint crate provides both **spec‑compliance checks** (complementary to `skills-ref validate`) and **best‑practice checks**. Rules are designed to be fast, deterministic, and configurable via TOML (see Lint Configuration section).

| Rule Category | Rule ID | Description | Default Severity |
|---------------|---------|-------------|------------------|
| **Frontmatter** | `fm-name-format` | Skill name must match directory name, use lowercase‑hyphen, 1‑64 chars. | error |
| | `fm-description-length` | Description must be 1‑1024 characters. | error |
| | `fm-description-content` | Description should not be too generic (heuristic). | warning |
| | `fm-license-present` | License field recommended (if not present). | info |
| | `fm-license-format` | License should be a standard identifier or path. | info |
| | `fm-compatibility-length` | Compatibility field ≤500 chars if present. | warning |
| | `fm-allowed-tools` | Allowed‑tools format (space‑separated, known tool names). | info |
| | `fm-metadata-keys` | Metadata keys should not conflict with future spec. | info |
| **Structure** | `file-skill-md-exists` | SKILL.md must exist. | error |
| | `file-skill-md-size` | SKILL.md < 500 lines recommended, < 5000 tokens. | warning |
| | `file-references-exist` | All referenced files (scripts/, references/, assets/) exist. | warning |
| | `file-references-depth` | References should not be deeply nested (max 2 levels). | info |
| **Content quality** | `content-examples` | Skill should include at least one example. | warning |
| | `content-steps` | Instructions should be step‑by‑step for complex tasks. | info |
| | `content-clarity` | Vague language detection (heuristic). | info |
| | `content-progressive-disclosure` | Main instructions should not exceed recommended size. | warning |
| **Security** | `sec-dangerous-tools` | Detects dangerous commands (shell, file writes) without warnings. | error |
| | `sec-allowed-tools-mismatch` | If allowed‑tools present, check it includes all used tools. | warning |
| **Compatibility** | `comp-dependencies` | If dependencies mentioned, list them. | info |
| | `comp-platform` | Check if skill requires specific OS or software (e.g., Windows‑only). | info |
| **Freshness** | `fresh-last-modified` | Skill not updated in >1 year (from Git or filesystem). | info |
| **Duplication** | `dup-shadowing` | (Client‑side) same skill name exists in higher‑priority source. | warning |

*Note: Basic spec validation (name format, description presence) overlaps with `skills-ref validate`. Our lint rules focus on additional quality and security checks that go beyond spec compliance. The platform may optionally run `skills-ref` as a separate validation step before ingestion.*

---

## ⚙️ Lint Configuration (TOML)

Users can configure lint rules via TOML files. Two levels of configuration are supported:

- **Global**: `~/.config/skilldeck/skilldeck-lint.toml` (or `%APPDATA%\skilldeck\skilldeck-lint.toml` on Windows)
- **Workspace**: `./.skilldeck/skilldeck-lint.toml` (overrides global settings for that workspace)

The configuration allows enabling/disabling rules and overriding their severity.

```toml
# ~/.config/skilldeck/skilldeck-lint.toml (global)

[defaults]
# All rules inherit from here if not overridden
severity = "warning"  # default severity for rules without explicit setting

[rules]
# Disable a rule entirely
fm-description-content = "off"

# Change severity of a rule
sec-dangerous-tools = "error"   # (already error, but explicit)
content-examples = "error"       # upgrade to error
fresh-last-modified = "info"     # downgrade to info

# Rule-specific parameters (future extensibility)
[rule-params.content-examples]
min_examples = 2   # require at least 2 examples instead of 1
```

**Workspace override example** (project‑specific):

```toml
# ./.skilldeck/skilldeck-lint.toml (workspace)

[rules]
# Stricter for this project
content-examples = "error"
fm-description-content = "warning"  # re-enable with warning
```

The client applies the workspace config on top of the global config (deep merge). The merged configuration is passed to the linting crate when calling `lint_skill`.

The linting crate exports a function:
```rust
pub fn lint_skill(skill_path: &Path, config: &LintConfig) -> Vec<LintWarning> { ... }
```

Where `LintConfig` is built from the merged TOML settings.

---

## 🧰 CLI Tool (`skilldeck-lint` binary)

The `skilldeck-lint` crate also provides a standalone CLI binary, built with [clap](https://crates.io/crates/clap), allowing developers to validate skills manually from the command line. This is useful for CI/CD pipelines, pre-commit hooks, or local testing without running the full SkillDeck application.

**Installation:**
```bash
cargo install skilldeck-lint
# or via package manager (future)
```

**Usage:**
```bash
# Validate a single skill directory
skilldeck-lint validate ./path/to/my-skill

# Validate with a custom config file
skilldeck-lint validate --config ./custom-skilldeck-lint.toml ./my-skill

# List all available lint rules
skilldeck-lint list-rules

# Generate a default config file
skilldeck-lint init-config > skilldeck-lint.toml
```

The CLI uses the same linting engine as the platform and client, ensuring consistent results. It respects the global config file (`~/.config/skilldeck/skilldeck-lint.toml`) and can be overridden with `--config`. Output is human‑readable by default, with an option for JSON (`--format json`) for programmatic consumption.

---

## 📡 Marketplace Registry API

The platform exposes a REST API for clients to discover skills.

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/skills` | List all public skills with pagination; supports filtering by category, tags, author, min quality score. |
| `GET /api/v1/skills/:id` | Full skill details: name, description, content, metadata, tags, category, lint warnings, version history. |
| `GET /api/v1/skills/search?q=...` | Full‑text search across name, description, tags, summary. |
| `GET /api/v1/categories` | List all categories with skill counts. |
| `GET /api/v1/trending` | Skills with recent updates or high popularity (requires analytics). |
| `GET /api/v1/sync?since=<timestamp>` | Delta endpoint returning skills updated since a given timestamp (for client cache). |
| `POST /api/v1/submit` | (Auth) Author submits a new skill repo for indexing. |

---

## 🖥️ Client‑Side Linting (Tauri Commands)

The client app provides immediate linting for local skills using the same `skilldeck-lint` crate compiled into the Tauri backend.

| Tauri Command | Description |
|---------------|-------------|
| `lint_skill(path: String) -> Vec<LintWarning>` | Lint a single skill directory (must contain `SKILL.md`). Returns list of warnings. |
| `lint_all_local_sources() -> Map<String, Vec<LintWarning>>` | Lint all skills in configured local sources (workspace, personal). |
| `get_lint_rules() -> Vec<LintRuleInfo>` | Return list of available lint rules with descriptions and default severity. |
| `set_lint_preferences(overrides: Map<RuleId, Severity>)` | (Deprecated) – now superseded by TOML config. Kept for backward compatibility. |

These commands are called from the React frontend when:
- Opening the skill browser (show inline warnings for local skills).
- Editing a skill (real‑time linting in the skill editor).
- Installing a skill from the registry (optional lint check before copy).

The client reads and merges the global and workspace TOML files on startup, and passes the merged config to every lint call.

---

## 🔁 Local + Remote Skill Resolution in Client

The client combines multiple sources:

| Source | Priority | Description |
|--------|----------|-------------|
| Workspace | 1 (highest) | `./.skilldeck/skills/` – project‑specific overrides. |
| Personal | 2 | `~/.agents/skills/` – user’s personal collection. |
| Team Git repos | 3 | Private repos configured in settings. |
| Central registry | 4 | Public skills from platform, read‑only (unless installed locally). |

**Resolution logic:**
- For each skill name, the highest‑priority source wins.
- If a skill exists in both local and registry, the local version is shown, but the UI can indicate a registry update is available.
- When a user “installs” a registry skill, the client copies its `SKILL.md` to the personal source and activates it.

**UI Enhancements:**
- Skill cards show a badge indicating source (workspace, personal, registry).
- Lint warnings from client‑side linting are shown inline.
- For registry skills, lint warnings from the platform are also displayed (merged with local if applicable).

---

## 🔄 Sync & Updates

| Feature | Description |
|---------|-------------|
| **Daily registry sync** | Client fetches delta updates from platform (skills modified since last sync). |
| **Manual refresh** | User can trigger a full refresh of the skill browser. |
| **Update notifications** | When a newer version of an installed skill exists in the registry, show an “Update available” badge. |
| **Install as copy** | Installing a registry skill copies the `SKILL.md` to personal source, allowing local modifications. |
| **Conflict resolution** | If local skill diverges from registry version, offer to merge (show diff) or keep local. |

---

## 🛠️ Implementation Roadmap

1. **Create `skilldeck-lint` crate** with initial set of rules, TOML config support, and CLI binary.
2. **Integrate lint crate** into `skilldeck-core` and expose Tauri commands.
3. **Build platform registry** (Axum + SQLite/PostgreSQL) with:
   - Ingestion from GitHub/GitLab.
   - LLM tagging (Ollama GLM5 cloud) with caching.
   - Cron linting on changed skills.
4. **Implement client UI** for skill browser (right‑panel tab) with filtering, search, and lint display.
5. **Add source management UI** in settings (reorder sources, add private Git repos).
6. **Implement sync** between client and platform (delta updates, caching).
7. **Add installation flow** (copy to personal source, activate).
8. **Beta test** with a handful of community skills.

---

## 🧪 Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **LLM cost / rate limits** | Cache results; only re‑tag when skill content changes significantly. Use a local model as fallback. |
| **Lint false positives** | Allow users to dismiss warnings or configure rule severity in TOML; maintain a known‑false‑positive list. |
| **Platform downtime** | Client uses cached registry; shows warning but still works with local skills. |
| **Malicious registry skills** | Manual review for featured skills; automated lint flags dangerous patterns; user must approve dangerous tools (existing tool approvals). |
| **Client‑side lint performance** | Lint runs in background thread; cache results per skill; only re‑lint on file change. |
| **Redundancy with `skills-ref`** | We treat `skills-ref` as a separate validation step; our lint crate provides additional checks. We can optionally integrate `skills-ref` results into our lint output. |
| **TOML config complexity** | Provide a default global config and clear UI for editing (maybe later a settings panel). |
