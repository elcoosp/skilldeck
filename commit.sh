#!/bin/bash
# commit-changed-files.sh
#
# Creates ONE conventional commit per changed file in the working tree.
# Bash 3.2 compatible (macOS default /bin/bash).
#
# - Skips changed.txt.
# - Auto-detects added / modified / deleted files.
# - Uses `git commit --only -- <path>` so only that file's change lands in
#   that commit, even if other files were already staged.
#
# Usage:  ./commit-changed-files.sh
#         DRY_RUN=1 ./commit-changed-files.sh   # print, don't commit

set -eu

cd "$(git rev-parse --show-toplevel)"

DRY_RUN="${DRY_RUN:-0}"

# ─── Per-file commit message ─────────────────────────────────────────────────
message_for() {
    local f="$1"

    case "$f" in
        changed.txt) return 1 ;;

        # ═════════════════════════════════════════════════════════════════
        # GitHub & CI
        # ═════════════════════════════════════════════════════════════════
        .github/PULL_REQUEST_TEMPLATE.md)
            echo "docs(github): normalize bullets and tables in PR template" ;;
        .github/workflows/ci.yml)
            echo "ci: rework E2E with tauri-plugin-playwright and add sccache" ;;
        .github/workflows/docs.yml)
            echo "ci(docs): point Vale at local styles and fix pnpm cache path" ;;
        .github/workflows/marketing-assets.yml)
            echo "ci(marketing): normalize YAML quoting" ;;

        # ═════════════════════════════════════════════════════════════════
        # Root config & docs
        # ═════════════════════════════════════════════════════════════════
        .gitignore)
            echo "chore: ignore output directory" ;;
        ARCHITECTURE.md)
            echo "docs: add paragraph spacing and reflow architecture tables" ;;
        CODE_OF_CONDUCT.md)
            echo "docs: normalize list markers in code of conduct" ;;
        CONTRIBUTING.md)
            echo "docs: space out code fences in contributing guide" ;;
        GOVERNANCE.md)
            echo "docs: reflow governance approval-path table" ;;
        README.md)
            echo "docs: reflow README tables and trim stray blank line" ;;
        SECURITY.md)
            echo "docs: reflow security tables and section headers" ;;
        biome.json)
            echo "chore(biome): bump schema, add file includes, enable strict rules" ;;
        cspell.json)
            echo "chore(cspell): add project words and ignore generated paths" ;;
        lefthook.yml)
            echo "chore(lefthook): pass --no-must-find-files to cspell" ;;
        lingui.config.ts)
            echo "chore(i18n): use po formatter function" ;;
        package.json)
            echo "chore(deps): bump dependencies and add coverage scripts" ;;
        pnpm-lock.yaml)
            echo "chore(deps): refresh pnpm lockfile" ;;
        pnpm-workspace.yaml)
            echo "chore(workspace): register e2e-tests and pin js-yaml" ;;

        # ═════════════════════════════════════════════════════════════════
        # docs/brand
        # ═════════════════════════════════════════════════════════════════
        docs/brand/*.svg)
            echo "docs(brand): add accessibility title to ${f##*/}" ;;
        docs/brand/*.md)
            echo "docs(brand): reflow tables and italicize asides in ${f##*/}" ;;

        # ═════════════════════════════════════════════════════════════════
        # docs/design
        # ═════════════════════════════════════════════════════════════════
        docs/design/TECH-STACK.md)
            echo "docs(design): reflow tech stack tables and fix JSX fence" ;;
        docs/design/archi-design.md)
            echo "docs(design): add spacing before nested code samples" ;;
        docs/design/ux-design.md)
            echo "docs(design): add spacing around nested UI mockups" ;;
        docs/design/ux-skills-files.md)
            echo "docs(design): normalize nested list formatting" ;;
        docs/design/v2-roadmap.md)
            echo "docs(design): reflow roadmap tables" ;;

        # ═════════════════════════════════════════════════════════════════
        # docs/issues  (frontmatter reformatting across many files)
        # ═════════════════════════════════════════════════════════════════
        docs/issues/closed/*.md)
            local stem="${f##*/}"
            stem="${stem%.md}"
            echo "docs(issues): normalize frontmatter in closed ${stem} issue" ;;
        docs/issues/*.md)
            local stem="${f##*/}"
            stem="${stem%.md}"
            echo "docs(issues): normalize frontmatter in ${stem} issue" ;;

        # ═════════════════════════════════════════════════════════════════
        # docs/reports
        # ═════════════════════════════════════════════════════════════════
        docs/reports/SkillDeck-UX-Research-Report.md)
            echo "docs(reports): space out audit finding headings" ;;
        docs/reports/code-block-plan.md)
            echo "docs(reports): add code-block enhancement implementation plan" ;;
        docs/reports/code-smells.md)
            echo "docs(reports): prettier-format code smells report" ;;
        docs/reports/coverage.md)
            echo "docs(reports): add current test coverage snapshot" ;;
        docs/reports/growth-hack.md)
            echo "docs(reports): reflow growth hack tables" ;;
        docs/reports/minimap.md)
            echo "docs(reports): add canvas minimap implementation plan" ;;
        docs/reports/skill-ab-bench.md)
            echo "docs(reports): italicize emphasis in A/B bench report" ;;
        docs/reports/thread-nav-smooth-scroll-heading.md)
            echo "docs(reports): prettier-format thread-nav report" ;;
        docs/reports/ux.md)
            echo "docs(reports): prettier-format UX report" ;;

        # ═════════════════════════════════════════════════════════════════
        # docs/spec
        # ═════════════════════════════════════════════════════════════════
        docs/spec/archi.md)
            echo "docs(spec): align traceability table columns" ;;
        docs/spec/bsr.md)
            echo "docs(spec): fix numbered list indentation in scenario" ;;
        docs/spec/srs.md)
            echo "docs(spec): add blank line inside skill YAML example" ;;

        # ═════════════════════════════════════════════════════════════════
        # docs/superpowers
        # ═════════════════════════════════════════════════════════════════
        docs/superpowers/plans/*.md)
            local stem="${f##*/}"
            stem="${stem%.md}"
            echo "docs(plans): add ${stem} execution plan" ;;

        # ═════════════════════════════════════════════════════════════════
        # e2e-tests
        # ═════════════════════════════════════════════════════════════════
        e2e-tests/fixtures.ts)
            echo "test(e2e): add playwright fixture with storage hygiene" ;;
        e2e-tests/package.json)
            echo "test(e2e): scaffold e2e-tests package" ;;
        e2e-tests/playwright.config.ts)
            echo "test(e2e): configure socket and cdp playwright projects" ;;
        e2e-tests/tests/app.spec.ts)
            echo "test(e2e): cover onboarding wizard launch flow" ;;

        # ═════════════════════════════════════════════════════════════════
        # public assets
        # ═════════════════════════════════════════════════════════════════
        public/illustrations/*.svg)
            echo "docs(assets): add title to ${f##*/}" ;;
        public/logo.svg)
            echo "docs(assets): add title to app logo" ;;

        # ═════════════════════════════════════════════════════════════════
        # scripts & demo storyboard
        # ═════════════════════════════════════════════════════════════════
        scripts/demo-reset.mjs)
            echo "chore(demo): add reproducible demo launch script" ;;
        scripts/dump-files.sh)
            echo "chore(scripts): add repo dump helper for LLM review" ;;
        skilldeck-demo.demo.md)
            echo "docs(demo): add storyboard for marketing video capture" ;;

        # ═════════════════════════════════════════════════════════════════
        # skilldeck-landing
        # ═════════════════════════════════════════════════════════════════
        skilldeck-landing/lingui.config.ts)
            echo "chore(landing/i18n): use po formatter function" ;;
        skilldeck-landing/package.json)
            echo "chore(landing/deps): bump radix, lingui, next and react" ;;
        skilldeck-landing/public/logo.svg)
            echo "docs(landing): add title to landing logo" ;;
        skilldeck-landing/skilldeck-product-analysis.md)
            echo "docs(landing): reflow product analysis tables" ;;
        skilldeck-landing/skilldeck-storybrand-script.md)
            echo "docs(landing): reflow storybrand comparison tables" ;;
        skilldeck-landing/src/app/changelog/page.tsx)
            echo "fix(landing/changelog): use stable list keys" ;;
        skilldeck-landing/src/app/globals.css)
            echo "chore(landing): reorder tailwind plugin imports" ;;
        skilldeck-landing/src/components/sections/CodeDemo.tsx)
            echo "fix(landing/code-demo): use composite keys for code lines" ;;
        skilldeck-landing/src/components/sections/FAQSection.tsx)
            echo "fix(landing/faq): key accordion items by question" ;;
        skilldeck-landing/src/components/shared/Header.tsx)
            echo "fix(landing/header): set explicit type on mobile menu button" ;;
        skilldeck-landing/src/components/ui/breadcrumb.tsx)
            echo "fix(landing/ui): make current breadcrumb page unfocusable" ;;
        skilldeck-landing/src/components/ui/carousel.tsx)
            echo "fix(landing/ui): wrap carousel region in section element" ;;
        skilldeck-landing/src/components/ui/input-otp.tsx)
            echo "chore(landing/ui): annotate OTP separator role" ;;
        skilldeck-landing/src/components/ui/sidebar.tsx)
            echo "chore(landing/ui): annotate sidebar cookie write" ;;
        skilldeck-landing/src/components/ui/slider.tsx)
            echo "chore(landing/ui): annotate slider thumb array index key" ;;
        skilldeck-landing/src/components/ui/toast.tsx)
            echo "chore(landing/ui): align toast variant props indentation" ;;
        skilldeck-landing/src/content/changelog.md)
            echo "docs(landing): add blank line after changelog heading" ;;
        skilldeck-landing/src/contexts/ABTestContext.tsx)
            echo "chore(landing/ab): annotate A/B cookie persistence" ;;

        # ═════════════════════════════════════════════════════════════════
        # skilldeck-lint
        # ═════════════════════════════════════════════════════════════════
        skilldeck-lint/Cargo.lock)
            echo "chore(lint/deps): refresh lockfile" ;;
        skilldeck-lint/Cargo.toml)
            echo "chore(lint/deps): bump specta and toml" ;;
        skilldeck-lint/tests/fixtures/sample-skill/SKILL.md)
            echo "chore(lint/test): normalize sample skill frontmatter" ;;

        # ═════════════════════════════════════════════════════════════════
        # skilldeck-marketing-assets
        # ═════════════════════════════════════════════════════════════════
        skilldeck-marketing-assets/package.json)
            echo "chore(marketing/deps): bump playwright and tauri-playwright" ;;
        skilldeck-marketing-assets/playwright.config.ts)
            echo "chore(marketing): prettier-format playwright config" ;;
        skilldeck-marketing-assets/scripts/rename-videos.ts)
            echo "chore(marketing): use node: import prefixes" ;;
        skilldeck-marketing-assets/src/fixtures.ts)
            echo "chore(marketing): use node: import prefix" ;;
        skilldeck-marketing-assets/src/pages/*.ts)
            echo "chore(marketing): use type-only playwright imports in ${f##*/}" ;;
        skilldeck-marketing-assets/src/test-data.ts)
            echo "chore(marketing): prettier-format test data module" ;;
        skilldeck-marketing-assets/tests/*.spec.ts)
            echo "chore(marketing): prettier-format ${f##*/}" ;;
        skilldeck-marketing-assets/tsconfig.json)
            echo "chore(marketing): compact tsconfig arrays" ;;

        # ═════════════════════════════════════════════════════════════════
        # skilldeck-platform
        # ═════════════════════════════════════════════════════════════════
        skilldeck-platform/Cargo.lock)
            echo "chore(platform/deps): refresh lockfile" ;;
        skilldeck-platform/Cargo.toml)
            echo "chore(platform/deps): bump axum, tokio and serde" ;;
        skilldeck-platform/feedback.md)
            echo "docs(platform): reflow feedback tech-stack table" ;;

        # ═════════════════════════════════════════════════════════════════
        # skilldeck-user-docs
        # ═════════════════════════════════════════════════════════════════
        skilldeck-user-docs/.markdownlint-cli2.jsonc)
            echo "chore(docs): add markdownlint config disabling noisy rules" ;;
        skilldeck-user-docs/.vale/styles/Microsoft/*.yml)
            echo "chore(vale): add Microsoft ${f##*/} rule" ;;
        skilldeck-user-docs/.vale/styles/write-good/*.yml)
            echo "chore(vale): add write-good ${f##*/} rule" ;;
        skilldeck-user-docs/.vale/styles/write-good/README.md)
            echo "chore(vale): attribute write-good style source" ;;
        skilldeck-user-docs/README.md)
            echo "docs(docs): reflow status lists and code fences" ;;
        skilldeck-user-docs/astro.config.mjs)
            echo "chore(docs): use items wrapper for autogenerate sidebar" ;;
        skilldeck-user-docs/package.json)
            echo "chore(docs/deps): bump astro, starlight and linkinator" ;;
        skilldeck-user-docs/public/favicon.svg)
            echo "chore(docs): add title to favicon" ;;
        skilldeck-user-docs/sprint.md)
            echo "docs(docs): reflow sprint roadmap tables" ;;
        skilldeck-user-docs/src/assets/logo.svg)
            echo "docs(docs): add title to docs logo" ;;
        skilldeck-user-docs/src/content/docs/en/how-to/*.md)
            echo "docs(docs/how-to): add blank line after frontmatter in ${f##*/}" ;;
        skilldeck-user-docs/src/content/docs/fr/how-to/*.md)
            echo "docs(docs/how-to): add blank line after French frontmatter in ${f##*/}" ;;

        # ═════════════════════════════════════════════════════════════════
        # src-tauri
        # ═════════════════════════════════════════════════════════════════
        src-tauri/Cargo.lock)
            echo "chore(tauri/deps): refresh lockfile" ;;
        src-tauri/Cargo.toml)
            echo "chore(tauri): add custom-protocol feature and bump deps" ;;
        src-tauri/capabilities/default.json)
            echo "chore(tauri): allow remote urls and playwright plugin perms" ;;
        src-tauri/migration/Cargo.toml)
            echo "chore(migration/deps): bump uuid" ;;
        src-tauri/migration/src/*.rs)
            echo "chore(migration): silence dead code in ${f##*/}" ;;
        src-tauri/skilldeck-core/Cargo.toml)
            echo "chore(core/deps): bump specta, tokio and reqwest" ;;
        src-tauri/skilldeck-core/src/db/connection.rs)
            echo "refactor(core/db): collapse nested ifs with let chains" ;;
        src-tauri/skilldeck-core/src/markdown/TOML.sublime-syntax)
            echo "chore(core/markdown): normalize quote style in TOML syntax" ;;
        src-tauri/skilldeck-core/src/markdown/renderer.rs)
            echo "feat(core/markdown): emit per-line HTML, tokens and minimap" ;;
        src-tauri/skilldeck-core/src/markdown/types.rs)
            echo "feat(core/markdown): add line, token and minimap fields" ;;
        src-tauri/skilldeck-core/src/mcp/registry.rs)
            echo "refactor(core/mcp): drop redundant Send + Sync bound" ;;
        src-tauri/skilldeck-core/src/mcp/stdio_transport.rs)
            echo "chore(core/mcp): add Default impl for StdioTransport" ;;
        src-tauri/skilldeck-core/src/providers/claude.rs)
            echo "refactor(core/claude): collapse ifs and silence dead fields" ;;
        src-tauri/skilldeck-core/src/providers/ollama.rs)
            echo "refactor(core/ollama): use builder and let chains" ;;
        src-tauri/skilldeck-core/src/providers/openai.rs)
            echo "refactor(core/openai): collapse ifs and drop unused log var" ;;
        src-tauri/skilldeck-core/src/skills/watcher.rs)
            echo "refactor(core/watcher): collapse emit check into let chain" ;;
        src-tauri/skilldeck-core/src/workspace/context.rs)
            echo "refactor(core/workspace): use sort_by_key and fix indentation" ;;
        src-tauri/skilldeck-models/Cargo.toml)
            echo "chore(models/deps): bump specta" ;;
        src-tauri/src/app_provision.rs)
            echo "feat(tauri/e2e): seed demo profile and workspace on empty db" ;;
        src-tauri/src/commands/artifacts.rs)
            echo "feat(tauri/artifacts): add write_artifact_to_file command" ;;
        src-tauri/src/commands/attachments.rs)
            echo "chore(tauri): silence dead code on AttachFilesPayload" ;;
        src-tauri/src/commands/bookmarks.rs)
            echo "chore(tauri/bookmarks): silence dead id and pass db ref" ;;
        src-tauri/src/commands/e2e.rs)
            echo "feat(tauri/e2e): expose is_e2e_testing command" ;;
        src-tauri/src/commands/messages.rs)
            echo "fix(tauri/messages): emit events on main thread to avoid deadlock" ;;
        src-tauri/src/commands/mod.rs)
            echo "chore(tauri): register run_code and e2e command modules" ;;
        src-tauri/src/commands/profiles.rs)
            echo "refactor(tauri/profiles): collapse default promotion into let chain" ;;
        src-tauri/src/commands/queue.rs)
            echo "fix(tauri/queue): emit queued-message events on main thread" ;;
        src-tauri/src/commands/run_code.rs)
            echo "feat(tauri/run-code): stream stdout/stderr from sandboxed runners" ;;
        src-tauri/src/commands/skills.rs)
            echo "refactor(tauri/skills): collapse lint reload into let chain" ;;
        src-tauri/src/commands/workflows.rs)
            echo "chore(tauri/workflows): drop redundant clone on created_at" ;;
        src-tauri/src/commands/workspaces.rs)
            echo "refactor(tauri/workspaces): rename FileEntry to WorkspaceFileEntry" ;;
        src-tauri/src/events.rs)
            echo "feat(tauri/events): add RunCodeEvent for code execution streaming" ;;
        src-tauri/src/lib.rs)
            echo "feat(tauri): wire run-code, artifact-save and e2e commands" ;;
        src-tauri/src/platform_client.rs)
            echo "refactor(tauri/platform): collapse cancel checks into let chains" ;;
        src-tauri/src/skills/folder_assembler.rs)
            echo "refactor(tauri/skills): collapse size guard into let chain" ;;
        src-tauri/src/state.rs)
            echo "feat(tauri/state): honour SKILLDECK_DATA_DIR and provision e2e" ;;
        src-tauri/src/subagent_registry.rs)
            echo "chore(tauri/subagent): silence dead code in registry handle" ;;
        src-tauri/tauri.conf.json)
            echo "chore(tauri): prettier-format deep-link config" ;;

        # ═════════════════════════════════════════════════════════════════
        # src (frontend)
        # ═════════════════════════════════════════════════════════════════
        src/App.css)
            echo "feat(frontend/css): add line numbers, search and minimap styles" ;;

        src/__tests__/accessibility/contrast.test.tsx)
            echo "test(accessibility): remove vacuous CSS contrast test" ;;
        src/__tests__/accessibility/keyboard-navigation.test.tsx)
            echo "test(accessibility): remove empty keyboard-navigation placeholder" ;;

        src/__tests__/components/message-bubble.browser.test.tsx)
            echo "test(components): update MessageBubble assertions to current markup" ;;
        src/__tests__/components/tool-call-card.browser.test.tsx)
            echo "test(components): assert full JSON path in ToolCallCard" ;;
        src/__tests__/components/thread-navigator.browser.test.tsx)
            echo "test(components): move ThreadNavigator test to happy-dom" ;;
        src/__tests__/components/*.browser.test.tsx)
            local base="${f##*/}"
            base="${base%.browser.test.tsx}"
            echo "test(components): add ${base} browser tests" ;;
        src/__tests__/components/*.test.tsx)
            local base="${f##*/}"
            base="${base%.test.tsx}"
            echo "test(components): add ${base} unit tests" ;;

        src/__tests__/helpers/*.tsx)
            echo "test(helpers): add query-client test harness" ;;

        src/__tests__/hooks/use-achievements.test.ts)
            echo "test(hooks): remove old use-achievements test" ;;
        src/__tests__/hooks/*.test.tsx)
            local base="${f##*/}"
            base="${base%.test.tsx}"
            echo "test(hooks): cover ${base}" ;;

        src/__tests__/lib/*.test.ts)
            local base="${f##*/}"
            base="${base%.test.ts}"
            echo "test(lib): cover ${base}" ;;

        src/__tests__/store/*.test.ts)
            local base="${f##*/}"
            base="${base%.test.ts}"
            echo "test(store): cover ${base}" ;;

        *) return 1 ;;
    esac
}

# ─── Iterate over every change ──────────────────────────────────────────────
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

{
    git diff --name-only HEAD 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
} | sort -u > "$tmp"

committed=0
skipped=0

while IFS= read -r f; do
    [ -z "$f" ] && continue

    if ! msg="$(message_for "$f")"; then
        skipped=$((skipped + 1))
        continue
    fi

    if [ "$DRY_RUN" = "1" ]; then
        printf '  • %s\n      %s\n' "$f" "$msg"
        continue
    fi

    git add -A -- "$f" 2>/dev/null || true
    if git commit -m "$msg" -- "$f" >/dev/null 2>&1; then
        committed=$((committed + 1))
        printf '  ✓ %s\n' "$f"
    else
        printf '  ✗ commit failed: %s\n' "$f" >&2
    fi
done < "$tmp"

[ "$DRY_RUN" = "1" ] && exit 0

printf '\nCommitted: %d\nSkipped  : %d (unknown paths or changed.txt)\n' \
       "$committed" "$skipped"
