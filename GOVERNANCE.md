# Governance

This document describes how decisions are made in the SkillDeck project, the roles involved, and the process for contributing to the project's direction.

## Project Lead

The project has a single **Project Lead** who is responsible for the overall vision, strategic direction, and final decisions when consensus cannot be reached. The current Project Lead is the founder of SkillDeck.

The Project Lead’s responsibilities include:

- Setting the product vision and roadmap.
- Making final decisions on scope and priorities.
- Approving releases.
- Resolving deadlocked discussions.

## Core Contributors

**Core Contributors** are community members who have made significant and sustained contributions to the project. They are granted write access to the repository and play a key role in day‑to‑day maintenance, code review, and feature development.

Core Contributors are expected to:

- Review pull requests in a timely and constructive manner.
- Adhere to the project’s code of conduct and quality standards.
- Participate in discussions about the project’s future.
- Mentor new contributors.

Becoming a Core Contributor is a recognition of trust and expertise. It is typically offered after a history of high‑quality contributions and positive interaction with the community.

## Community Contributors

Anyone who contributes – by reporting bugs, suggesting features, writing documentation, or submitting code – is a **Community Contributor**. All contributors are valued members of the SkillDeck community.

## Decision Making

We strive to make decisions through open, consensus‑based discussion. The process generally follows these steps:

1. **Discussion** – Any significant change should be discussed first in a GitHub issue or Discord thread. This allows the community to provide input early.

2. **ADR (Architecture Decision Record)** – For technical decisions that have lasting impact, we require an ADR. The ADR template is available in `docs/adr/TEMPLATE.md`. The ADR should be discussed and refined until it reaches a stable state.

3. **Consensus Building** – The goal is to reach a rough consensus among active contributors. If consensus cannot be reached, the Project Lead may make a final decision after considering all viewpoints.

4. **Implementation** – Once a decision is made, it can be implemented via a pull request. The pull request should reference the discussion or ADR.

### Types of Changes and Approval Paths

| Change Type                               | Approval Path                                                                 |
|-------------------------------------------|-------------------------------------------------------------------------------|
| Bug fixes, minor improvements             | Any Core Contributor can review and merge (with passing CI).                  |
| New features, significant refactors       | Should be discussed first; requires at least one Core Contributor approval.   |
| Architecture decisions (ADRs)             | Must go through ADR process; requires Project Lead sign‑off.                  |
| Vision or roadmap changes                 | Must be discussed with the community; final decision by Project Lead.         |
| New Core Contributor                         | Nominated by existing Core Contributors or Project Lead; approved by Project Lead. |

## Release Management

Releases are managed by the Project Lead, with input from Core Contributors. The release process is documented in the [Release Process](RELEASE.md). We follow semantic versioning (MAJOR.MINOR.PATCH).

## Code of Conduct

All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). The Project Lead and Core Contributors are responsible for enforcing it.

## Changes to Governance

This governance document itself can be amended through the same decision‑making process: open discussion, consensus building, and final approval by the Project Lead.
