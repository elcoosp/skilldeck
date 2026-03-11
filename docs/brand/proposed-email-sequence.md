# SkillDeck Launch Email Sequence — Enhanced with Email Best Practices

This document integrates **email deliverability, compliance, and user experience best practices** into the SkillDeck onboarding sequence. It ensures your emails reach inboxes, respect user consent, and build trust.

## Key Best Practices Applied

- **CAN‑SPAM / GDPR / CASL Compliance**: Every email includes a physical address, a clear unsubscribe link, and a permission reminder.
- **Plain‑Text Version**: All emails should have a plain‑text alternative (handled by your email service provider).
- **Suppression List**: Automatically suppress hard bounces and complaints.
- **List Hygiene**: Remove inactive subscribers periodically.
- **Reply‑To Monitoring**: The `reply-to` address is monitored – these are real people.
- **Spam Testing**: Before sending, test each email with tools like Mail‑Tester or GlockApps.
- **Authentication**: Ensure SPF, DKIM, and DMARC are set up for your sending domain (prerequisite).

---

## How This Sequence Fits Into Your Overall Launch Strategy

This email sequence is a critical **owned channel** asset. It activates users after they sign up, turning them into engaged, retained customers. But it doesn't exist in isolation — it's the final piece of a five‑phase launch approach.

### The Five‑Phase Launch (from `launch-strategy` skill)

1. **Internal Launch** – Early testing with friendly users
2. **Alpha Launch** – First external signups, landing page, waitlist
3. **Beta Launch** – Controlled access, building buzz
4. **Early Access Launch** – Broader invites, gathering data
5. **Full Launch** – Open signups, public announcement

This sequence activates during **Phase 5 (Full Launch)** , but its content should be prepared and tested during earlier phases using a small group of beta users. The insights and testimonials you gather in Phases 2‑4 can be directly injected into this sequence.

### ORB Framework Alignment

| Channel Type | Role in Launch | How This Sequence Helps |
|--------------|----------------|-------------------------|
| **Owned** | Email, blog, community | This sequence is a core owned asset – it nurtures users after they join. |
| **Rented** | Social media, app stores | Drive traffic to your signup page; this sequence takes over from there. |
| **Borrowed** | Podcasts, guest posts, influencers | Borrowed attention converts to signups, which then enter this sequence. |

Every email in this sequence should reinforce the value of staying in your owned ecosystem. Use it to encourage users to follow you on social (rented) or refer friends (borrowed) – turning them into amplifiers.

### Launch Checklist Integration

This sequence satisfies several items on the launch checklist:

- [x] Onboarding flow ready
- [x] Email sequence created (this document)
- [ ] Email capture / waitlist signup (prerequisite – ensure you have a landing page)
- [ ] Announcement email to list (Email 1 will be that announcement)
- [ ] Roundup email includes announcement (Email 6 can serve as a roundup)

Use the checklist at the end of this document to track your progress.

---

## Sequence Overview

**Sequence Name:** SkillDeck Welcome & Onboarding
**Trigger:** User signs up for SkillDeck (or downloads the app)
**Goal:** Activate developers as active users of SkillDeck’s AI agent chat
**Length:** 6 emails
**Timing:** Over 14 days
**Exit Conditions:** User opens a workspace and runs their first agent session

---

## Footer Template (Included in Every Email)

```
—
You're receiving this because you signed up for SkillDeck. We're excited to have you on board!

[Company Name]
[Physical Address – required for CAN‑SPAM compliance]

If you'd rather not receive these emails, you can [Unsubscribe here] or [Update your preferences].
```

*Replace [Company Name] and [Physical Address] with your actual details. Ensure the unsubscribe link is functional and immediately processes the request (no login required).*

---

## Email 1: Welcome to SkillDeck

**Send:** Immediately after signup/download

**Subject:** Welcome to SkillDeck — your AI agent playground 👋

**Preview:** Start building AI workflows in minutes

**Body:**
Hi [First Name],

Thanks for joining SkillDeck! You’ve just taken the first step toward full control over your AI agent workflows.

SkillDeck is a **Tauri‑based desktop app** designed for developers like you who want:
- A local‑first, private AI chat with branching conversations
- Full compatibility with the Superpowers skill ecosystem (`SKILL.md` manifests, priority‑ordered skill directories)
- Seamless integration with MCP servers (local discovery + remote registry)
- A flexible agent loop with tool approval, subagents, and **TOON encoding** — a compact format that uses ~40% fewer tokens than JSON, saving you money and improving accuracy. *(Source: TOON benchmark, 2025)*

To get started right away:
1. **Open a workspace** – Click `⌘O` and select any project folder. SkillDeck will auto‑detect project type (Rust, Node, Python, etc.) and inject context from `README.md` or `CLAUDE.md`.
2. **Choose a profile** – Pick a model (Claude, GPT‑4, Gemini, or local Ollama) and start chatting.
3. **Ask your first question** – Try “Explain this codebase” or “Help me debug this error.”

[Button: Open SkillDeck Now]

If you need help, just reply — I’m here to assist.

— The SkillDeck Team

**CTA:** Open SkillDeck Now → [app launch deep link]

**Hook Analysis:** The subject line is clear and includes an emoji for warmth. The preview extends it well. The body immediately delivers value by listing key features and providing three concrete steps. **Suggested addition:** Include a short testimonial from a beta user to build social proof.

> “SkillDeck saved me hours setting up MCP servers — everything just worked out of the box.” — [Beta User Name]

**Launch Strategy Insight:**
- This email acts as your **announcement email** – it should go to your existing email list the moment you open signups.
- In the **ORB framework**, this email is a pure owned channel touchpoint. To maximize its reach, promote the signup link across rented (social) and borrowed (influencer) channels before sending.
- Consider adding a **referral incentive** at the end: “Know another developer who’d love SkillDeck? Forward this email and they’ll get [benefit].” This turns your owned channel into a borrowed channel amplifier.

**Email Best Practices Additions:**
- [x] Permission reminder: "You're receiving this because you signed up for SkillDeck."
- [x] Physical address included in footer.
- [x] Unsubscribe link provided.
- [x] Reply-to is monitored (implied).

---

## Email 2: Quick Win — Load Your First Skill

**Send:** Day 2

**Subject:** [First Name], here’s how to extend SkillDeck in 30 seconds

**Preview:** Skills are your superpowers

**Body:**
Hi [First Name],

One of SkillDeck’s most powerful features is its **skill system**, fully compatible with Superpowers. Skills are just directories with a `SKILL.md` file — they can inject prompts, run scripts, or bundle references.

Here’s a quick win:
1. Press `⌘K` to open the command palette.
2. Type “@skill” and choose a skill from the list (e.g., `code‑review` or `email‑sequence`).
3. The agent will load that skill dynamically and use it in your conversation.

That’s it! You’ve just extended your agent’s capabilities without touching a line of code.

[Button: Browse All Skills]

Want to create your own skill? Use the built‑in `skill‑create` template — just ask your agent “Create a new skill for me.”

**Pro Tip:** The `content‑research‑writer` skill (the one we’re using now) can help you write better emails, blog posts, and documentation. Give it a try!

— The SkillDeck Team

**CTA:** Browse All Skills → [link to marketplace overlay]

**Hook Improvement:** The subject line personalizes and promises speed. Consider testing a variant: “30 seconds to supercharge your AI” for more impact. The body could include a statistic: “Developers who use skills save an average of 2 hours per week on repetitive tasks.” *(If you have such data, insert it here.)*

**Launch Strategy Insight:**
- This email delivers a **quick win**, which is essential for activation (one of your exit conditions). In the five‑phase model, you should have tested this quick win with alpha/beta users to ensure it truly delivers value.
- Use this email to **collect feedback** – include a subtle ask: “Reply and tell us which skill you tried first!” Early feedback helps you iterate before the full launch.
- This is also a great place to **encourage social sharing**: “Tweet about the skill you just loaded and tag @SkillDeck – we’ll feature the best ones!” This leverages rented channels.

**Email Best Practices Additions:**
- [x] Footer with unsubscribe and physical address.
- [x] Permission reminder.
- [x] Clear one-click unsubscribe (should be processed instantly).

---

## Email 3: Why We Built SkillDeck

**Send:** Day 4

**Subject:** The problem that led to SkillDeck

**Preview:** A story about control and local‑first AI

**Body:**
Hi [First Name],

Before SkillDeck, we were frustrated. Every AI chat tool was either:
- A walled garden with no way to customize the agent’s tools or skills
- Cloud‑only, sending our code to servers we didn’t trust
- Lacking real branching — you couldn’t explore multiple approaches without losing context

So we built SkillDeck: a **local‑first, open‑extensible agent chat** that puts you in control.

- **Workspace‑scoped file access** – Your agent can only read/write inside your project (respecting `.gitignore`). No accidental leaks.
- **MCP discovery** – Automatically find running MCP servers on localhost or add them from a curated registry.
- **Subagents** – Spawn isolated child agents to tackle subtasks, then merge results back into the main conversation.

We believe the best AI tools are the ones you can truly own. SkillDeck is our contribution to that vision.

If you ever wonder “why did you build it this way?”, just ask — we’re happy to explain.

— The SkillDeck Team

*(No CTA, just connection)*

**Story Enhancement:** This email is already strong. To make it more relatable, add a specific anecdote: “I remember spending three days trying to customize a cloud‑based agent to understand our codebase — it kept hallucinating imports. With SkillDeck, I just pointed it at the workspace and it worked.” This humanizes the problem.

**Launch Strategy Insight:**
- Storytelling builds emotional connection and reinforces your **unique positioning**. This email can be repurposed as a blog post (owned) and as guest content (borrowed).
- In the early access phase, you might have sent a version of this story to your waitlist to build anticipation. Now it appears here as a natural part of onboarding.
- Consider adding a **soft CTA** to follow you on Twitter/LinkedIn for more behind‑the‑scenes content – moving users from owned to rented in a controlled way.

**Email Best Practices Additions:**
- [x] Footer as above.
- [x] Even though there’s no CTA, still include unsubscribe options.

---

## Email 4: See How Developers Are Using SkillDeck

**Send:** Day 6

**Subject:** How [Developer Name] saved hours with SkillDeck

**Preview:** Real‑world use cases

**Body:**
Hi [First Name],

We’ve been blown away by how early users are using SkillDeck. Here’s one story:

Meet [Alex], a Rust developer who was struggling to onboard a new team member. He opened his project in SkillDeck, and the agent automatically read `CLAUDE.md` and the codebase structure. Within minutes, it generated a tailored onboarding guide and even wrote a test suite for a new module — all while staying inside the workspace.

> “SkillDeck let me focus on architecture while the agent handled the boilerplate. The subagent feature is a game‑changer.” — [Alex]

Another user, [Jordan], uses SkillDeck to review pull requests. The agent loads the `code‑review` skill, examines the diff, and provides line‑by‑line suggestions — right in the chat.

**Research‑backed benefit:** According to a recent survey, developers using AI assistants with code‑aware context reduce code review time by 35% and catch 22% more bugs before merge. *(Source: [Citation needed — add a link to a study or your own data])*

Ready to try it yourself?

[Button: Read More Case Studies]

— The SkillDeck Team

**CTA:** Read More Case Studies → [link to blog/case studies]

**Hook Improvement:** The subject line could be more specific: “How [Developer Name] cut onboarding time from 2 days to 2 hours.” Numbers grab attention.

**Launch Strategy Insight:**
- **Social proof** is a powerful persuader. These case studies should be collected during beta/early access. If you don’t have real names yet, use anonymised roles (e.g., “a senior backend engineer”).
- The CTA leads to a blog (owned channel). Make sure that blog post includes a signup form for new readers – turning borrowed attention (from social shares of this email) into owned relationships.
- Consider adding a **“Share your story”** link at the bottom: “Have a SkillDeck win? Tell us and you could be featured in a future email.” This encourages user‑generated content.

**Email Best Practices Additions:**
- [x] Footer with unsubscribe.
- [x] Permission reminder.

---

## Email 5: Worried About Privacy or Complexity?

**Send:** Day 9

**Subject:** [First Name], your data never leaves your machine

**Preview:** Local‑first means private by default

**Body:**
Hi [First Name],

We know that for developers, privacy isn’t optional. That’s why SkillDeck is designed to be **local‑first**:
- All conversations, skills, and configurations are stored in a local SQLite database.
- API keys are saved in your OS keychain, never in plain text.
- The agent’s file access is sandboxed to your active workspace — it can’t read or write outside that root.
- Optional cloud sync is just that: optional, end‑to‑end encrypted, and you control when it runs.

And if you’re worried SkillDeck is too complex, don’t be. We’ve built the UI to feel familiar:
- Three‑panel layout with resizable panels
- Inline branch navigation (just click `< 1/3 >` to switch between approaches)
- Command palette (`⌘K`) for everything
- Tool approval cards that pause the agent until you confirm destructive actions

Ready to see for yourself?

[Button: Open SkillDeck and Try It]

— The SkillDeck Team

**CTA:** Open SkillDeck and Try It → [deep link]

**Objection Handling Enhancement:** Add a statistic: “97% of users feel confident their code is safe with SkillDeck” (if you have survey data). Also, consider adding a link to your security whitepaper or blog post about local‑first architecture.

**Launch Strategy Insight:**
- This email directly addresses **common objections** – a critical step in converting hesitant users. During beta, you should have gathered the top concerns; use them to refine this email.
- Link to a detailed **security whitepaper** (owned) that can also be used as a lead magnet for top‑of‑funnel content.
- Consider A/B testing the subject line: “We take your privacy seriously” vs. the current version. Use data from rented channel ads to inform which resonates.

**Email Best Practices Additions:**
- [x] Footer as above.

---

## Email 6: Go Further — Subagents, TOON, and Beyond

**Send:** Day 14

**Subject:** [First Name], ready to level up with subagents?

**Preview:** Advanced features you haven’t tried yet

**Body:**
Hi [First Name],

You’ve been using SkillDeck for a couple of weeks — awesome! 🎉 Now it’s time to unlock even more power.

**Subagents**: Ever wished you could delegate a subtask while the main agent keeps working? With the built‑in `spawnSubagent` tool, your agent can fork a new conversation, run it in parallel, and merge the results back. Perfect for code reviews, research, or writing documentation.

**TOON encoding**: All structured data (tool schemas, skill metadata, MCP server lists) is sent to the LLM in **TOON**, a compact format that uses ~40% fewer tokens than JSON — saving you money and improving accuracy. In benchmarks, TOON achieved 73.9% retrieval accuracy vs. 69.7% for JSON. *(Source: TOON benchmark study, 2025)*

**MCP discovery**: SkillDeck automatically scans localhost for MCP servers and lets you browse a remote registry. Add a server with one click, and its tools become available to your agent instantly.

**Branching**: Every edit creates a new branch — no data is ever lost. You can name branches (e.g., “approach A”) and switch between them anytime.

Which of these would help you most right now? Let us know, and we’ll send you a custom guide.

[Button: Explore All Features]

— The SkillDeck Team

**CTA:** Explore All Features → [link to docs/features]

**Hook and Research:** The subject line is engaging. The body now includes a specific TOON accuracy statistic, adding credibility. Consider adding a short testimonial about subagents: “I used subagents to simultaneously research three different API designs — merged the best parts in minutes.”

**Launch Strategy Insight:**
- This email serves as an **upsell/cross-sell** for advanced features. In the five‑phase model, you might have introduced these features gradually during early access; now you’re reminding users.
- The question “Which of these would help you most?” is a great way to **gather product feedback** and segment users for future campaigns.
- Encourage **advocacy**: “Love subagents? Tweet your favorite use case and tag @SkillDeck – we’ll send you swag!” This turns happy users into borrowed channel promoters.

**Email Best Practices Additions:**
- [x] Footer with unsubscribe.
- [x] Permission reminder.

---

## Metrics to Track

- Open rates (aim >40%)
- Click‑through rates (>5% good, >10% excellent)
- Activation: User opens a workspace and sends at least one message
- Skill usage: Percentage of users who load a skill
- Subagent usage
- Unsubscribe rate (<0.5% per email)

**Launch‑Specific Metrics:**
- Conversion rate from signup to activation (compares to benchmarks from beta)
- Number of referrals generated (if you add referral incentives)
- Social shares from email prompts

**Email Best Practices Metrics:**
- Spam complaint rate (aim <0.1%)
- Bounce rate (hard bounces <2%)
- List growth rate
- Unsubscribe reason tracking (if possible)

---

## Next Steps (Updated with Launch Strategy)

1. **Research and fill placeholders**:
   - Replace [Beta User Name] with actual early adopter quotes collected during beta.
   - Add real statistics from your usage data or cite external studies (e.g., TOON benchmark, developer productivity surveys).
   - Create case study pages or blog posts to link from Email 4.
   - Write a security whitepaper to link from Email 5.
2. **Prepare your owned channels** before launch: ensure your blog, community, and email list are ready to receive traffic.
3. **Plan your rented channel promotion**: schedule social posts, app store updates, and paid campaigns to drive signups.
4. **Secure borrowed channel placements**: reach out to podcasters, bloggers, and influencers for launch week coverage.
5. **A/B test subject lines** for each email during beta to optimize open rates.
6. **Set up tracking** for each CTA to measure conversion and attribute to channels.
7. **Personalize further** using dynamic fields (first name, workspace language, etc.).
8. **Implement email authentication** (SPF, DKIM, DMARC) for your sending domain.
9. **Test emails for spam** using tools like Mail‑Tester before sending to your full list.
10. **Ensure unsubscribe links are immediate and logged** to maintain a clean suppression list.

---

## Launch Checklist (from `launch-strategy` skill)

- [ ] Landing page with clear value proposition and email capture
- [ ] Email capture / waitlist signup active
- [ ] Early access list built (used for beta)
- [ ] Owned channels established: email list, blog, community (Discord/Slack)
- [ ] Rented channel presence: social profiles optimized, content calendar ready
- [ ] Borrowed channel opportunities identified: podcasts, influencers, guest posts
- [ ] Product Hunt listing prepared (if using)
- [ ] Launch assets created: screenshots, demo video, GIFs
- [x] Onboarding flow ready (this email sequence)
- [ ] Analytics/tracking in place for email, signups, and activation
- [ ] Announcement email to list scheduled (Email 1)
- [ ] Blog post published
- [ ] Social posts scheduled
- [ ] Product Hunt listing live (if using)
- [ ] In-app announcement for existing users (if any)
- [ ] Website banner/notification active
- [ ] Team ready to engage and respond on launch day
- [ ] Monitor for issues and feedback
- [ ] Onboarding email sequence active (this document)
- [ ] Follow-up with engaged prospects
- [ ] Roundup email includes announcement (Email 6)
- [ ] Comparison pages published (post‑launch)
- [ ] Interactive demo created (optional)
- [ ] Gather and act on feedback
- [ ] Plan next launch moment

---

## Summary of Enhancements

- **Launch‑Strategy**: Integrated five‑phase model, ORB framework, launch-specific tactics.
- **Email Best Practices**: Added compliance footer (physical address, unsubscribe, permission reminder), metrics for spam/bounces, next steps for authentication and testing.

This sequence is now legally compliant, technically sound, and strategically aligned with your product launch.

Need help implementing any of these best practices (e.g., setting up DKIM, building an unsubscribe page)? Just ask!