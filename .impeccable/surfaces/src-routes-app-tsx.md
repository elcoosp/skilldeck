---
version: 1
slug: "src-routes-app-tsx"
primary_target: "src/routes/_app.tsx"
related_targets: ["src/routes/_app/index.tsx","src/routes/_app/conversations.$conversationId.tsx","src/routes/_app/settings.tsx"]
---

# Surface brief: SkillDeck app shell (all screens)

## Direction contract

THESIS: The cabin safety card — instructions engineered to stay legible in turbulence. SkillDeck is the pre-flight briefing for your agents: every tool call approval-gated like a checklist row, every state stamped where you can see it, and nothing (code, keys, prompts) ever leaves the aircraft. It refuses the category default of dark glassy AI chat with neon glow.

OWN-WORLD: Cool paper-grey ground, white card-stock surfaces, near-black ink; safety orange owns decisions and nothing else (primary actions, active destination marker, approval gates); caution amber, exit green, alert red, info blue do state jobs only. Hanken Grotesk carries voice — sentence case, one message per line; JetBrains Mono strictly for data (tokens, paths, IDs, tabular numerals). Rules drawn at one device pixel and only where they mean something; states are stamped on the object; modest punched-card radii (8–10px); focus dims neighbors; a single session status band reports one message at a time.

STORY: A developer scanning the deck thinks: "I can see exactly what my agents are about to do, approve it like a checklist, and my code never leaves this machine." They navigate by the orange followed-path marker band-to-band, read agent activity in one place, and trust the deck because denied actions leave visible stamps instead of vanishing.

FIRST VIEWPORT: The standard three-panel workbench, untouched navigation model. Left: workspace rail + conversation deck with the orange active marker and clean group headers. Center: the briefing — thread of stamped message rows, then the decision strip (message input) with suggested prompts as checklist chips. Right: systems panel (Session / Skills / MCP / Artifacts / Files / Workflow / Analytics) behind a one-message status band. The signature move lives in the approval gate (tool calls as check rows with Approve/Deny decisions) and the orange followed-path marker.

FORM: Assigned grounded direction #6 of 7 (aviation safety-card world). SEED REFERENCE: seed: e50891ae303b6c74. Raised lines (named donors): split-flap's single live activity band; Emigre's device-pixel + data-only mono discipline; ticket wallet's stamped states; streaming wall's focus-dimming; centre-rail's 1px rule meaning; yellow wayfinding's one-message bands and followed-path highlight.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
