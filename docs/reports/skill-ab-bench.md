Let me dig into this one properly — it's deceptively deep once you trace all the existing infrastructure it can build on.

## Skill A/B bench — replay with swapped skills

The core UX is simple: pick any past conversation, swap one or more skills, and see the responses side-by-side. But the interesting part is *how much of this is already built*.Here's the full picture, starting with how the data flow actually works:Now here's what the actual UI surface would look like — the bench configuration step is where most of the UX design lives:Here's the full breakdown of what makes this feature tick:

---

## What you'd actually be building

**The data layer is almost free.** `conversation_skill_overrides` already exists in `skilldeck-models`. Every conversation already stores which skills were active. The replay mechanism just needs to: (1) load a conversation's message history, (2) strip the last N assistant turns, (3) re-run the agent loop from message K with a different `skill_overrides` payload. The agent loop, streaming, and context builder are all already there in `skilldeck-core`.

**The `version-diff-modal.tsx` extension.** Right now it diffs artifact content between branches. You'd extend it to accept two streaming `AgentResponse` streams side by side, and run a word-level diff on the assistant messages once both streams complete. `react-diff-viewer-continued` is already in your dependencies — you're literally one component away.

**The "replay from message K" optimization** is the killer UX detail. Long conversations have a lot of agreed context in the early messages — re-running all 12 messages just to compare the last 3 is wasteful and slow. Letting users pick a "fork point" makes benching fast enough to feel iterative. This maps directly to the branching model you already have: it's essentially creating a temporary branch at message K with a different skill override.

---

## The three moments that make it delightful

**The configuration step** (top of the mockup) is where you set Run A vs B. The key detail is that you can optionally override the model for B only — this unlocks "does this skill perform better with Opus vs Sonnet?" as a question, which no other tool answers cleanly. The "replay from message 6" checkbox is the usability detail that turns a 30-second operation into a 4-second one.

**The metrics row** (the four cards) is what makes results shareable and trustworthy. Response length delta, latency delta, "N/12 messages differ" — these are the signals that tell a skill author at a glance whether v1.3-beta is meaningfully different or just noise. No competitor gives skill authors quantitative feedback about their own changes.

**"Promote B as active skill"** closes the loop. Instead of the user manually going to settings and swapping the skill, one click makes B the active skill for this conversation (and optionally globally). This is what turns a debugging tool into a workflow.

---

## The non-obvious tricky bit

Model non-determinism means Run A and Run B will never be exactly the same even with identical inputs. You need to decide whether to freeze Run A (use the stored messages) or re-run it live. Re-running both gives you a fair comparison at the cost of 2x API calls. Using the stored Run A messages is faster and cheaper but subtly unfair if the stored response is from a different model temperature session. The right default is probably "use stored Run A, re-run only Run B" — which is also what makes the feature feel instantaneous rather than slow.
