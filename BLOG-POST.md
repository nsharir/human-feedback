# Closing the Loop: How I Made My AI Agents Actually Listen to Me

*A small CLI tool, a few HTML files, and a much faster human-agent feedback loop.*

---

I've been working with AI coding agents — Claude Code, Cursor, Codex, Hermes — every day for the past year. And the most frustrating part isn't what you'd expect.

It's not hallucinations. It's not context windows. It's not even cost.

**It's that I can't give them feedback fast enough.**

## The painful loop

Here's what a typical interaction looks like when an agent produces something substantial — a design doc, a UI mockup, a refactoring plan:

1. Agent: "Here's the spec I drafted. Want me to proceed?"
2. Me: *opens the file, reads it carefully*
3. Me: "Yes, but on line 47 — I don't think we need PGP at v1. Also the priority of the AI features should be higher. And the wording in section 3 is too aggressive."
4. Agent: *makes changes*
5. Me: *re-reads, finds three more things*
6. Repeat 4–7 times.

Every round trip is me **typing prose to describe locations in a document**. "The paragraph about authentication." "The third bullet under the API section." "The button in the top right of the mockup."

I'm a senior engineer. I shouldn't be writing coordinates as prose.

## What I actually want

What I wanted was something like Google Docs comments, but for whatever the agent just produced — markdown, HTML, anything. Highlight the text. Type a comment. Hand the structured feedback back.

The constraints:

- **No server.** I don't want to spin up infrastructure for this.
- **No integrations.** No accounts, no OAuth, no webhooks.
- **Works with any agent harness.** Claude Code, Cursor, Codex, Hermes — same UX.
- **Output the agent can actually parse.** Not screenshots. Not vague messages.

So I built it.

## agent-feedback

[`agent-feedback`](https://github.com/nsharir/agent-feedback) is a tiny CLI. It compiles your agent's output — `.md`, `.html`, or a questionnaire `.json` — into a **self-contained HTML file** with a feedback layer baked in. The human opens it in a browser, gives feedback inline, and copies a structured prompt back to the agent.

Three tools, one command:

```bash
# Wrap a markdown spec
agent-feedback compile spec.md -o spec.review.html

# Wrap an HTML mockup
agent-feedback compile mockup.html -o mockup.review.html

# Bake a questionnaire
agent-feedback compile questions.json -o intake.html
```

That's it. No server, no API key, no signup.

## The three-stage loop in practice

The way I use it most often is a three-stage loop that maps to how real product work happens.

### Stage 1: Pin down requirements before any drafting

I don't want the agent to start writing code or specs based on what it *thinks* I want. So I have it generate a questionnaire first — multi-format inputs covering audience, platforms, priorities, deadlines, constraints.

The human (me, or a stakeholder) fills it out in the browser, and the agent gets a structured answer back covering everything it needs to know.

![Feedback questioner demo](https://raw.githubusercontent.com/nsharir/agent-feedback/main/examples/demos/feedback.gif)

### Stage 2: Annotate the functional spec

The agent drafts a spec from those answers. I open the rendered markdown in a browser, highlight any sentence, and leave a comment. Each annotation gets a floating ID label (A1, A2, …) — same UX as Google Docs.

When I'm done, I click "Copy Prompt" and paste a structured natural-language prompt back to the agent. The prompt tells the agent exactly which line each comment refers to, what the original text said, and what I want changed.

![Markdown annotator demo](https://raw.githubusercontent.com/nsharir/agent-feedback/main/examples/demos/md-annotator.gif)

### Stage 3: Critique the mockup

For UI work, the agent ships an HTML mockup. I open it, **click on any element**, and leave a comment. CSS selectors are captured automatically so the agent knows exactly what I was pointing at.

![HTML annotator demo](https://raw.githubusercontent.com/nsharir/agent-feedback/main/examples/demos/html-annotator.gif)

## Why this accelerates the loop

Three things change once you stop typing coordinates as prose:

- **Round-trip time per review drops dramatically.** I'm not describing locations; I'm highlighting and commenting. The bottleneck moves from "express the feedback" back to "decide on the feedback."
- **Round-trips per draft go down.** When the agent gets a structured prompt referencing specific lines, it's far less likely to misinterpret what I meant. Two iterations instead of five.
- **Cognitive load drops.** I'm reading critically, not playing coordinate-translator. That's the real unlock.

The win isn't UX cleverness. It's that **structured feedback is just easier for the agent to act on than prose**. The agent doesn't have to guess which paragraph I meant. The address is in the prompt.

## The implementation philosophy

Three principles, in case anyone wants to build something similar:

1. **No server.** Everything compiles to a single self-contained HTML file. The "backend" is the clipboard.
2. **One output format.** Every tool emits the same structured natural-language prompt. The agent can parse it the same way every time.
3. **Native hook integration.** A single `agent-feedback install` command patches Claude Code / Cursor / Codex / Hermes hook configs so any file the agent writes gets auto-wrapped — no manual compile step.

The whole thing is ~3,000 lines of vanilla JS. No framework. No build pipeline beyond a simple file-inliner.

## Try it

```bash
npm install -g @nsharir/agent-feedback
agent-feedback install   # interactive setup for your harness
```

Or one-shot:

```bash
npx @nsharir/agent-feedback compile some-spec.md -o review.html
```

Repo: [github.com/nsharir/agent-feedback](https://github.com/nsharir/agent-feedback)

---

*Engineering leader passionate about new technology and how it can accelerate teams. Experimenting with AI tools and practices on a daily basis.*
