---
id: implement-onboarding-wizard-and-progressive-unlock
title: Implement onboarding wizard and progressive unlock
labels:
  - frontend
  - 'priority:must'
  - 'type:feature'
  - 'size:medium'
assignees:
  - elcoosp
references:
  - ../plans/v1.md#15-chunk-12-react-frontend--components
state: open
createdAt: '2026-03-12T13:59:50.861Z'
priority: must
effort: 1d
dependencies:
  - 'Implement Tauri commands for profiles, skills, and MCP'
  - Implement Tauri commands for settings and export
---
## Context

The onboarding wizard guides new users through setup, and progressive unlock reveals features as users become more experienced.

**Related Plan Section:**
- [Chunk 12: React Frontend — Components](../plans/v1.md#15-chunk-12-react-frontend--components)

**Related Requirements:**
- [REQ-USA-003](../spec/srs.md#req-usa-003) - Complete onboarding in < 5 minutes
- [G-7](../spec/vision.md#g-7) - Progressive onboarding with Playground experience

## Problem Statement

We need to implement the onboarding wizard for first-time users and the progressive unlock system that reveals features over time.

## Solution Approach

### Implementation Details

**Files to create:**
- `src/components/onboarding/onboarding-wizard.tsx` — Onboarding wizard
- `src/components/onboarding/playground-banner.tsx` — Playground banner
- `src/components/shared/unlock-notification.tsx` — Unlock notification
- `src/store/unlock.ts` — Progressive unlock state

**OnboardingWizard:**
- Step 1: Welcome and introduction
- Step 2: API key setup
- Step 3: Profile creation
- Step 4: Playground activation
- Skip option for experienced users

**Progressive unlock stages:**
1. Basic chat (unlocked by default)
2. Skills (unlocked after first skill)
3. MCP tools (unlocked after first tool approval)
4. Workflows (unlocked after first workflow)

**UnlockNotification:**
- Toast notification when new feature unlocks
- Brief explanation of new feature
- Link to documentation

## Acceptance Criteria

- [ ] Onboarding wizard guides through setup
- [ ] API key is stored in keychain
- [ ] Profile is created
- [ ] Playground is activated
- [ ] Progressive unlock tracks feature usage
- [ ] Unlock notifications appear
- [ ] Onboarding can be skipped
- [ ] Onboarding completes in < 5 minutes

## Testing Requirements

**BDD scenarios:**
- [SC-FUNC-026](../spec/test-verification.md#sc-func-026) - Profile management
- [SC-FUNC-027](../spec/test-verification.md#sc-func-027) - API key storage in keychain
- [USA-005](../spec/test-verification.md#usa-005) - Onboarding completion

## Dependencies

- **Blocked by:** Settings commands, Profile commands
- **Blocks:** None

## Effort Estimate

- **Complexity:** Medium
- **Effort:** 1d
