# Stop Explaining Yourself to Your AI Agent: Fix the Feedback Loop

*The agent isn't slow. You are. Here's how to stop being the bottleneck.*

---

The agent isn't slow. The agent isn't even wrong, mostly.

But us, the humans, are now the bottleneck. You're reading a spec and trying to describe *which paragraph* you disagree with. You're staring at a mockup and typing "the button in the top-right of the second row" because there's no other way to point. You're answering "just a few clarifying questions" for the fourth time today.

. . .

The thinking part is easy.

***Delivering the feedback back to the agent* is what's killing you.**

That's the loop I wanted to fix.

## What human-feedback is

[`human-feedback`](https://github.com/nsharir/human-feedback) is a small CLI that turns any agent output into a reviewable, annotatable artifact.

It handles three kinds of agent output:

- **Markdown specs and plans** — become a rendered doc with Google-Docs-style highlighting and comments. Each annotation gets a floating ID label (A1, A2...) so you and the agent can refer to it precisely.
- **HTML mockups** — become click-to-annotate prototypes. Click on any element, leave a comment, and the CSS selector is captured automatically. No more "the button on the top-left."
- **Questionnaires** — become real forms with text fields, dropdowns, multi-select, ratings, file uploads. The agent asks structured questions, you answer structurally. No more wall-of-prose Q&A.

The really cool thing is that even if the agent responded with just an endless message full of details and questions — you can easily transform that into a human-reviewable artifact.

All three tools end the same way: you click, you annotate, and then you click **Copy Prompt**. A structured natural-language prompt, written so any agent can parse it, lands on your clipboard.

Paste it back. The agent knows exactly which line, which element, which answer each comment refers to.

No server. No accounts. No OAuth. No webhooks. The "backend" is your clipboard. Every output is a single self-contained HTML file you can open offline, share over Slack, or commit to a repo.

## The part that matters: you don't run it

Here's the thing that changes how you should think about this:

**You don't run the CLI. The agent does.**

`human-feedback install` adds a skill to your agent harness — Claude Code, Cursor, Codex, Hermes.

You do this once.

You never touch the CLI again. It's just *there*, as a command ready for you to trigger whenever human feedback is needed. No matter if the agent output is a markdown file, an HTML file, or just a very long message — this tool will transform it into an artifact that you can easily review and respond to.

That is the whole point.

## What it looks like in practice

### The agent asks you what you want

You know how it goes: the agent dumps a long message with a dozen questions for you to respond to...

What do you do? You just reply with a single command:

```
/human-feedback
```

This generates a full-blown questionnaire for you to easily respond to every question. You fill it in, and when you're done, click copy and paste it back to the agent.

![Feedback questioner demo](https://raw.githubusercontent.com/nsharir/human-feedback/main/examples/demos/feedback.gif)

### The agent drafts a spec

The agent writes markdown — or even worse, it just sends you an inline message with a specification in place.

Now you're struggling to provide feedback on different sections of the text. That is painfully time-consuming.

What do you do? You just reply with the same single command:

```
/human-feedback
```

It restructures the spec into a human-reviewable artifact with a comment layer baked in. Highlight any sentence, type a comment, and get floating labels highlighted in the text.

When you're done? Just click "Copy Prompt" and hand the agent a structured response: *which line, what it said, what you want changed.*

![Markdown annotator demo](https://raw.githubusercontent.com/nsharir/human-feedback/main/examples/demos/md-annotator.gif)

### The agent ships a UI mockup

The agent renders HTML. A great step forward!

But yet again, it's so hard to provide feedback...

> "Look at the button at the left side panel, on the top — it isn't aligned"

> "The card at the center of the screen needs to be aligned to the toolbar above"

Sound familiar?

No more. As you can guess — just fire the same single command:

```
/human-feedback
```

You get a reviewable HTML mockup. Open it, click on any element, and leave a comment. The CSS selector goes with it.

The agent sees exactly what you were pointing at — no spatial prose, no guessing.

Then, just click copy and you have well-structured feedback to paste back to the agent.

![HTML annotator demo](https://raw.githubusercontent.com/nsharir/human-feedback/main/examples/demos/html-annotator.gif)

### The agent just... responds with text

This is the part most people don't expect. The agent doesn't need to have written a file. If it just replied with a long text message — an analysis, a list of recommendations, a draft email — you can invoke `/human-feedback` and the agent will take its own response, save it as a markdown or HTML artifact, and compile it into a reviewable surface on the spot. Any textual agent output becomes a human-reviewable artifact. You never need to copy-paste into a doc or say "can you write that to a file first."

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
3. **Wires itself in.** `human-feedback install` adds a skill to your harness once. After that, you forget the tool exists — which is exactly what good tools do.

## Try it

One command to install it, one command to use it.

Installation: just tell your agent to set it up:

```
Please install https://github.com/nsharir/human-feedback
```

Note: most tools require a new session for the command and the skill to take effect.

Next time your agent drafts a spec, renders a mockup, or asks you a list of questions, just type:

```
/human-feedback
```

It will do the magic, with no further instructions needed.

Repo: [github.com/nsharir/human-feedback](https://github.com/nsharir/human-feedback)

You're all welcome: to use it, to give feedback, or to suggest PRs!

---

*Engineering leader passionate about new technology and how it can accelerate teams. Experimenting with AI tools and practices on a daily basis.*
