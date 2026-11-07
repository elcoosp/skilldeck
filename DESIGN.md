# SkillDeck — Design System

Recorded at finish from the built world (safety-card redesign, 2026-11). This
document describes what ships, not aspirations. The visual world replaced the
previous slate/blue/Poppins system; the information architecture, features,
copy, and component APIs are unchanged.

## World: the safety card

SkillDeck is the pre-flight briefing for local AI agents: every tool call is
approval-gated, every state is stamped where it can be seen, nothing leaves the
machine. The interface borrows four things from the aviation safety-card world
and nothing else: **type voice, palette, density, and one signature move**
(followed-path highlighting + stamped states). Layout, navigation, and controls
remain standard desktop-tool patterns.

Two themes ship together, at equal fidelity:

- **Light — "day cabin."** Cool paper ground, white card stock, ink text.
- **Dark — "night cabin."** Deep charcoal-blue ground, elevated card surfaces,
  same accents. Selected via the existing theme setting (light/dark/system).

## Tokens

All tokens live in `src/App.css` (Tailwind 4 CSS-first). shadcn semantic names
are preserved; only values changed.

### Color

| Token | Light | Dark | Job |
| --- | --- | --- | --- |
| `--background` | `#eef0f4` paper | `#14171c` cabin | app ground |
| `--card` | `#ffffff` stock | `#1d2128` | surfaces, panels, modals |
| `--foreground` | `#171a20` ink | `#eceef2` | text |
| `--primary` | `#f4622a` safety orange | `#ff6a33` | decisions only: primary actions, active path, approval |
| `--primary-foreground` | ink `#171a20` | `#1a1208` | text on orange (≥5.5:1) |
| `--secondary` | `#232833` ink slab | `#2a303b` | dark chips/badges |
| `--muted` / `--muted-foreground` | `#e6e9ee` / `#5a6472` | `#262b33` / `#98a1ad` | subtle fills / secondary text (≥6:1 on card) |
| `--border` / `--input` | `#d4d9e0` / `#c9cfd8` | `#2c323c` / `#333a45` | 1px rules, inputs |
| `--ring` | safety orange | safety orange | focus |
| `--destructive` | `#c11a10` | `#e03d33` | destructive actions/errors |

State channels (do state jobs only, never decoration):

- `--tone-success` `#15803d` / `#4ade80` — approved, connected, installed
- `--tone-warning` `#b45309` / `#fbbf24` — caution, lint warnings, queued
- `--tone-danger` `#c11a10` / `#f87171` — blocked, failed
- `--tone-info` `#35567e` / `#7aa5d8` — system, neutral information

Rules:

- Orange owns **decisions and nothing else**: buttons that act, the active
  conversation/profile/tab marker, approval affordances. A number, a border, or
  a label is not a decision.
- State colors are stamps: applied to badges, dots, and text that report a
  state. Hardcoded Tailwind palette colors in components are being replaced by
  these tokens (`bg-teal-500` → `--tone-success`, etc.).
- Data series (charts) use `--chart-1..5`: orange, slate-ink blue, amber,
  green, grey.

### Typography

- Voice: **Hanken Grotesk** (`@fontsource/hanken-grotesk`, 400–700) — humanist,
  signage-legible, sentence case. One family carries headings, labels, body,
  and controls.
- Data: **JetBrains Mono** (`@fontsource/jetbrains-mono`, 400–600) — strictly
  for data: code, tokens, paths, IDs, kbd hints, tabular numerals. Never for
  UI labels.
- Base 16px root; UI runs dense (13–14px body, 11–12px metadata). Heading
  tracking −0.015em. `--font-sans` / `--font-mono` mapped in `@theme inline`.
- `prelayout` measurement config (`src/lib/markdown-layout.ts`) must match these
  faces or virtualized thread heights drift.

### Shape, depth, rules

- `--radius: 0.5rem` (8px) with the shadcn ladder (sm 4.8 → 4xl 20.8). Modest,
  punched-card corners; pills only for badges/chips.
- Depth: soft offset shadows with real blur (e.g. the message-input decision
  strip). No zero-offset colored halos, no hard offset blocks.
- Rules carry meaning: 1px `--border` lines group and separate (teaching lists,
  card footers, settings sections). No colored side stripes on cards or list
  items; code-line highlights are background-only.
- Focus: 2px orange ring (`ring-ring/40..50`) on inputs/cards; visible
  `focus-visible` outlines on interactive elements.

## Signature moves

1. **Followed path** — the active destination is stamped band-to-band in the
   orange family: active conversation (`bg-primary/10` + `border-primary/40`),
   active settings nav, active right-panel tab (`bg-primary/10 text-primary`),
   active workspace avatar ring.
2. **Stamped states** — states are printed on the object and stay legible:
   queued messages carry an amber chip + left rule; installed/available skills
   use tone-colored badges and status dots; denied/failed things stay visible.
3. **The decision strip** — the message input is the one chrome-heavy surface:
   card stock, soft depth shadow, orange focus border while composing, floating
   mode pill beneath.
4. **Night-slab code** — code blocks render as a dark tool-window slab in both
   themes with line numbers and JetBrains Mono; syntax colors come from the
   Tauri-rendered theme CSS.

## Components

- Buttons (`ui/button.tsx`): default = safety orange with ink text; destructive
  = tonal red; outline/ghost/secondary unchanged in behavior.
- Cards/dialogs: `bg-card` + `border-border` (1px rule, no ring-glow), radius
  from the ladder.
- Badges: pill, tone-tinted (`--tone-*/10` bg, `--tone-*` text, `/30` border).
- Status dots: 6px round, tone-colored — the compact list-row state marker.
- Scrollbars: global thin themed track/thumb from `--border`; `.thin-scrollbar`
  remains for dense lists. `::selection`, caret, and placeholders themed.

## Motion

- 150–250ms ease-out on state transitions; framer-motion kept for list
  enter/exit and the thread. Exponential easing (`cubic-bezier(0.22, 1, 0.36, 1)`)
  on splash card slides; no bounce/elastic. No page-load orchestration — the
  app loads into the task.
- Empty states keep their Lottie/SVG illustrations under
  `public/illustrations/`; `prefers-reduced-motion` disables the Lottie path.

## Surfaces (where the world lands)

- **Splash** — night cabin ground, three dealt cards (orange gradient / ink
  slab / paper), orange progress bar, no glow.
- **Onboarding** — orange progress rail, state-colored feature rows, orange
  CTA with ink text ("Deal me in" retained).
- **Home briefing** (`routes/_app/index.tsx`) — replaces the previous blank
  center panel: heading, one-paragraph privacy promise, orange primary +
  outline secondary actions, suggested-prompt chips, ruled teaching list,
  ⌘K hint.
- **Left panel** — workspace rail (avatar rings in orange when active),
  conversation deck with group headers, active stamp.
- **Center** — thread (plain assistant voice, orange-tinted user stamps,
  amber queued stamps, dark code slabs) + decision strip.
- **Right panel** — icon rail with squared orange active tab; Session stats in
  mono tabular numerals; skill cards with dashed footers, tone badges, trust
  scores; MCP live cards with tone-success connection dots; analytics with the
  safety-orange heatmap ramp and mono tables.
- **Settings** — card-stock modal, orange active nav, segmented controls with
  orange selection.

## Provenance

All shipping rasters used for verification are runtime captures (Playwright,
1440×900, light + dark) of the actual build driven through a Tauri IPC shim —
no AI-generated imagery ships in the app. Verification set:
onboarding, home, conversation, skills, MCP, analytics, settings × light/dark.
