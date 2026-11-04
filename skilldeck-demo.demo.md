---

viewport: { width: 1200, height: 800 }
fps: 30
typingSpeed: 48
voiceover:
provider: edge
voiceId: en-US-JennyNeural
captions:
format: both
burn: true
variables:
appName: "SkillDeck"
chatPrompt: "How would you refactor this function?"
branchName: "Try recursion"
skillSearch: "code review"
workflowName: "Launch Pipeline"
workflowDef: '{"name":"Launch Pipeline","pattern":"sequential","steps":[{"id":"a","name":"Review the pull request","prompt":"Review the latest pull request and summarize issues."},{"id":"b","name":"Check security","prompt":"Run a quick security audit of the repo."}],"dependencies":[{"from":"a","to":"b"}]}'
---

{{appName}} — the AI workspace that keeps your code on your machine.

Every AI coding tool sends your code to the cloud. Your company's secrets, your client's data — gone to somebody else's servers. You shouldn't have to choose between AI and privacy.

`waitFor(300)`
`type('textarea[placeholder*="Type a message"]', '{{chatPrompt}}')`
`click('button[aria-label="Send"]')`
SkillDeck runs entirely on your computer. Ask a question — the answer streams in real time.

Watch it work — no cloud round-trip, no waiting in line.
`waitFor(10000)`

The entire thread stays on your machine — encrypted, local, yours.
`waitFor(10000)`

Ready to try something different? Fork the conversation and start a new branch.
`pointerClick('last=button[aria-label="Message options"]')`
`waitFor(700)`
`click('text=Branch from here')`
`waitFor(900)`
`type('input[placeholder="Branch name (optional)"]', '{{branchName}}')`
`waitFor(250)`
`click('text=Create branch')`
`waitFor(1500)`

One conversation, two branches. Flip between them — nothing is ever lost.
`click('text=Exit branch')`
`waitFor(1000)`
`click('button[aria-label="Next branch"]')`
`waitFor(1000)`

Need a specialist? SkillDeck ships with a skills hub. Search, preview, and enable verified AI experts — every skill is open, inspectable, and safe.
`click('button[aria-label="Skills"]')`
`waitFor(1400)`
`click('button[title="Search skills"]')`
`waitFor(500)`
`type('input[placeholder="Search skills…"]', '{{skillSearch}}')`
`waitFor(1400)`
`click('text=code-review-expert')`
`waitFor(1200)`

Here's the real magic — orchestrate agents as a visual DAG. Each step runs in sequence, each step doing one thing very well.
`click('button[aria-label="Workflow"]')`
`waitFor(1200)`
`click('text=New')`
`waitFor(600)`
`type('#workflow-name', '{{workflowName}}')`
`waitFor(300)`
`fill('#workflow-definition', '{{workflowDef}}')`
`waitFor(200)`
`click('text=Save')`
`waitFor(1800)`
`click('button[title="Edit"]')`
`waitFor(1200)`
`click('text=Cancel')`
`waitFor(600)`
`click('button[title="Run"]')`
`waitFor(1800)`

Built with Rust and React. Everything stays on your machine. Open source — see exactly how every piece works.
`click('button[aria-label="Files"]')`
`waitFor(1400)`
`click('button[aria-label="Session"]')`
`waitFor(1200)`

Try it today — link in the README. SkillDeck — your AI, your rules.
`waitFor(2500)`
