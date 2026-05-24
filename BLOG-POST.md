# Stop Explaining Yourself to Your AI Agent: Fix the Feedback Loop

*The agent isn't slow. You are. Here's how to stop being the bottleneck.*

---

Ever felt tired of giving feedback to an AI agent?

Reading a plan, checking a mockup, answering a list of questions — and then realizing the feedback is harder than the actual work?

The agent isn't slow. The agent isn't even wrong, mostly. But you, the human, are now the bottleneck. You're reading a spec and trying to describe which paragraph you disagree with. You're staring at a mockup and typing "the button in the top-right of the second row" because there's no other way to point. You're answering "just a few clarifying questions" for the fourth time today.

**The thinking part is easy. The delivering-the-thinking-back-to-the-agent part is what's killing you.**

That's the loop I wanted to fix.

## What human-feedback is

[`human-feedback`](https://github.com/nsharir/human-feedback) is a small CLI that turns any agent output into a reviewable, annotatable HTML file. It handles three kinds of agent output:

- **Markdown specs and plans** — become a rendered document with Google-Docs-style highlighting and comments. Each annotation gets a floating ID label (A1, A2...) so you and the agent can refer to it precisely.
- **HTML mockups** — become click-to-annotate prototypes. Click on any element, leave a comment, and the CSS selector is captured automatically. No more "the button on the top-left."
- **Questionnaires** (a tiny JSON schema) — become real forms with text fields, dropdowns, multi-select, ratings, file uploads. The agent asks structured questions, you answer structurally. No more wall-of-prose Q&A.

All three tools end the same way: you click **Copy Prompt**, and a structured natural-language prompt — written so any agent can parse it — lands on your clipboard. Paste it back. The agent knows exactly which line, which element, which answer each comment refers to.

No server. No accounts. No OAuth. No webhooks. The "backend" is your clipboard. Every output is a single self-contained HTML file you can open offline, share over Slack, or commit to a repo.

## The part that matters: you don't run it

Here's the thing that changes how you should think about this:

**You don't run the CLI. The agent does.**

`human-feedback install` adds a skill to your agent harness — Claude Code, Cursor, Codex, Hermes. You do this once. From that moment on, whenever you type `/human-feedback` (or just say "let me review that"), the agent automatically picks up the latest artifact it produced — the markdown spec it just drafted, the HTML mockup it just built, or the questions it needs answered — compiles it into a reviewable file, and hands you a link.

You annotate and paste back. The agent continues with precise, structured feedback.

The friction of "remember to run a tool" would have killed it, so I removed that friction entirely. You install it once. You never touch the CLI again. It's just there, quietly wiring itself between the agent and you.

## What it looks like in practice

### The agent asks you what you want

Instead of dumping a paragraph of questions into chat, the agent collects everything it needs into a structured form: typed inputs, dropdowns, priorities, deadlines, constraints. You fill it in your browser. Copy. Paste back. Every answer is labeled and typed — no ambiguity.

![Feedback questioner demo](https://raw.githubusercontent.com/nsharir/human-feedback/main/examples/demos/feedback.gif)

### The agent drafts a spec

The agent writes 150 lines of markdown. Instead of reading a wall of text in chat, it opens in your browser as a rendered document with a comment layer baked in. Highlight any sentence, type a comment, get floating A1, A2... labels. When you're done, "Copy Prompt" gives the agent a structured message: which line, what it said, what you want changed.

![Markdown annotator demo](https://raw.githubusercontent.com/nsharir/human-feedback/main/examples/demos/md-annotator.gif)

### The agent ships a UI mockup

The agent renders HTML. You open it, click on any element, and leave a comment. The CSS selector goes with it. The agent sees exactly what you were pointing at — no spatial prose, no guessing.

![HTML annotator demo](https://raw.githubusercontent.com/nsharir/human-feedback/main/examples/demos/html-annotator.gif)

## Why this changes the loop

Three things shift the moment you stop typing coordinates as prose:

- **Round-trip time per review drops dramatically.** You're not describing locations; you're highlighting and commenting. The bottleneck moves back to "decide on the feedback" — where your brain should be.
- **Round-trips per draft go down.** Structured prompts referencing specific lines and selectors are far less prone to misinterpretation. Two iterations instead of five.
- **Cognitive load drops.** You're reading critically, not translating spatial reasoning into prose. That's the real unlock.

The win isn't UX cleverness. It's that **structured feedback is just easier for the agent to act on than prose**. The address is in the prompt.

## Implementation philosophy

Three principles, for anyone curious about building something similar:

1. **No server.** Every output is a single self-contained HTML file. The "backend" is the clipboard.
2. **One output format.** Every tool emits the same structured natural-language prompt. The agent parses it the same way every time.
3. **Wires itself in.** `human-feedback install` adds the skill to your harness once. After that, you forget the tool exists — which is exactly what good tools do.

## Try it

One command, then forget about it:

```bash
npm install -g @nsharir/human-feedback
human-feedback install   # interactive — pick your harness
```

Next time your agent drafts a spec, renders a mockup, or asks you a list of questions — type `/human-feedback`. It compiles the latest artifact, opens the reviewable version, and you highlight, comment, and paste back.

No more typing "the paragraph about authentication."

Repo: [github.com/nsharir/human-feedback](https://github.com/nsharir/human-feedback)

---

*Engineering leader passionate about new technology and how it can accelerate teams. Experimenting with AI tools and practices on a daily basis.*
