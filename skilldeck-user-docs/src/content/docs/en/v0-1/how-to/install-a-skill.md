---
title: "How to Install a Skill from the Registry"
description: Step-by-step instructions for finding and installing skills from the SkillDeck marketplace or directly from GitHub.
sidebar:
  order: 1
---

import Nudge from '../../../../../components/mdx/Nudge.astro';
import Checkpoint from '../../../../../components/mdx/Checkpoint.astro';
import Feedback from '../../../../../components/mdx/Feedback.astro';

The SkillDeck registry is a growing marketplace of community‑contributed skills. You can also install skills directly from any GitHub repository using a simple command.

<Nudge type="tip" title="Before you start">
  Make sure you have SkillDeck running and an active conversation open.
</Nudge>

## Method 1: Install from the Registry (UI)

### Step 1: Open the Skills Tab

1. In the right sidebar, click the **Skills** tab (icon with two overlapping squares).
2. You'll see the **Unified Skill List**, which combines:
   - **Registry skills** (available to install) – marked with a cloud icon or "Available" badge.
   - **Local skills** (already installed) – marked with a folder icon or "Installed" badge.

### Step 2: Search for a Skill

Use the search bar at the top of the Skills tab. You can search by:

- Skill name (e.g., `code review`)
- Description keywords (e.g., `python`, `testing`)
- Category (select from the dropdown if available)

<Nudge type="tip" title="Search tips">
  Try broad terms first. If you're looking for a Python code review skill, search for `python` or `review`.
</Nudge>

### Step 3: Evaluate the Skill

Click on any skill card to open the detail panel. Here you'll find:

- **Description** – what the skill does.
- **Author** and **License** – who created it and under what terms.
- **Tags** – keywords like `code-review`, `python`.
- **Lint Warnings** – any issues detected by the linter (e.g., missing description, dangerous patterns).
- **Trust badges** – security and quality scores (1–5).

Pay special attention to **security warnings**. Skills with a low security score (e.g., 1/5) may use dangerous tools like shell execution – install only if you trust the author and understand the risks.

<Checkpoint question="Have you reviewed the skill's details and trust scores?" onYes="If you're comfortable, proceed to installation." onNo="Take a moment to read the lint warnings and scores." />

### Step 4: Install the Skill

1. Click the **Install Skill** button in the detail panel.
2. A dialog will ask where to install the skill:
   - **Personal** – saves to `~/.agents/skills/` (available for all your conversations).
   - **Workspace** – saves to `./.skilldeck/skills/` inside your current workspace (only available when that workspace is open).
3. Choose your preferred location and click **Install Copy**.

<Nudge type="warning" title="Overwrite warning">
  If a skill with the same name already exists in that location, SkillDeck will ask whether to overwrite it. Choose wisely – overwriting cannot be undone.
</Nudge>

<Checkpoint question="Did the skill install without errors?" onYes="Great! It will now appear in your local skills list." onNo="Check the error message – it might be a conflict or a missing dependency." />

## Method 2: Install Directly from GitHub (Command Line)

If you know the GitHub repository of a skill (e.g., `owner/repo`), you can install it directly using the `npx skills` command. This downloads the skill to your personal skills folder (`~/.agents/skills/`).

### Step 1: Open a Terminal

Open your terminal (command prompt) and ensure you have Node.js installed (npx comes with npm).

### Step 2: Run the Install Command

```bash
npx skills <owner/repo>
```

For example, to install a skill from `github/example-skill`:

```bash
npx skills github/example-skill
```

This will:
- Clone the repository (or download the skill directory) into `~/.agents/skills/example-skill`.
- Preserve the `SKILL.md` and any other files.

<Nudge type="tip" title="Note">
  The repository must contain a valid `SKILL.md` file at its root. If the repository has multiple skills, you may need to specify a subdirectory – check the skill's documentation.
</Nudge>

### Step 3: Verify Installation

1. Restart SkillDeck or refresh the Skills tab.
2. Your new skill should appear under **Local** skills.

<Checkpoint question="Does the skill appear in the Skills tab?" onYes="Perfect! You can now use it with `@skillname`." onNo="Check that the repository contains a valid `SKILL.md` and that you used the correct owner/repo format." />

## Using Your Installed Skill

1. Go back to the **Conversation** tab.
2. Type `@` followed by the skill name (e.g., `@code-review`). The skill should appear in the command palette.
3. Select it, then provide any input the skill needs (e.g., code to review).
4. Send the message.

## Next Steps

- [Install an MCP server](/en/latest/how-to/add-mcp-server/filesystem-server) to give the agent access to external tools.
- [Configure profiles](/en/latest/how-to/configure-profiles) to switch between AI providers.
- [Share your own skill](/en/latest/tutorials/build-a-skill/share-via-gist) with the community.

<Feedback />
