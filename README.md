# human-feedback

**Give precise feedback on long agent output — without losing your mind.**

AI agents write a lot. A 200-line functional spec. An HTML mockup. A multi-step migration plan. Reading all of that inside a chat window is painful. Scrolling back and forth, trying to remember which paragraph had the issue, then typing "the part about auth near the middle needs work" and hoping the agent figures out what you mean.

`human-feedback` fixes this. It compiles agent output into an interactive HTML page you open in a browser — click on an element, highlight a paragraph, annotate a section — then copies a structured prompt back to the agent with exact references (CSS selectors, line numbers, question IDs). The agent knows precisely what to fix.

Three tools for three kinds of output:

- **HTML Annotator** — click-to-annotate any HTML page the agent produced
- **Markdown Annotator** — review a rendered spec/plan with line-number-referenced comments
- **Questionnaire** — structured Q&A when the agent needs decisions from you before continuing

Just type `/human-feedback` — the agent automatically picks up the latest artifact it produced (the HTML page it just wrote, the markdown spec it just drafted, or the questions it needs answered), compiles it into a reviewable format, and hands you a link. No need to specify files or remember paths.

No server. No browser extension. No integrations. Just a slash command and a browser.

```
Agent produces a long artifact
  → you type /human-feedback
  → agent auto-detects the artifact and compiles it
  → you open the link, review and annotate
  → you copy the structured prompt back
  → agent reads precise, line-level feedback and continues
```

---

## See it in action

**End-to-end walkthrough** — from intent capture to mockup feedback, with narration:

https://github.com/user-attachments/assets/982e3634-de48-4745-b29e-ce2cd60665b7

A typical project has three stages where you need to give the agent precise feedback. Here's how each one works:

### 1. Gather requirements with a questionnaire

The agent has been reading your codebase and needs to make decisions — but instead of asking you 8 questions one at a time in chat, it collects them into a structured form. Radio buttons for choices, text fields for details, scales for priorities. You fill it out in your browser and paste back a clean prompt with every answer labeled and typed.

![Feedback questioner demo](examples/demos/feedback.gif)

### 2. Annotate the functional spec

The agent drafted a 150-line markdown spec. Instead of reading it as a wall of text in chat, you open it as a rendered document — click on any section, highlight specific text, leave comments anchored to exact line numbers. The agent gets back a prompt that says "Line 42: this auth flow needs a refresh token step" instead of "somewhere in the auth section, you missed something."

![Markdown annotator demo](examples/demos/md-annotator.gif)

### 3. Annotate the HTML mockup

The agent built an HTML prototype. You open it in your browser and click on the actual elements — the hero section, a button, a card layout — and leave comments attached to CSS selectors. The agent knows exactly which `div.pricing-card > h3` you're talking about.

![HTML annotator demo](examples/demos/html-annotator.gif)

---

## Quick start

### 1. Install

```bash
npm install -g @nsharir/human-feedback
```

### 2. Add to your agent

```bash
human-feedback install
```

That's it. The installer detects which agent harnesses are present and installs the skill into each one.

### 3. Use it

In Claude Code:
```
you:   Write a functional spec for the new auth system
agent: [writes auth-spec.md — 180 lines]
you:   /human-feedback
agent: [compiles auth-spec.md → auth-spec.review.html, shares link]
       Ready for your review: file:///Users/you/project/auth-spec.review.html
you:   [open in browser, annotate 4 sections, copy prompt, paste back]
agent: [reads line-referenced feedback, updates the exact sections]
```

In Cursor:
```
you:   Build the landing page mockup
agent: [writes landing.html]
you:   Let me review that with human-feedback
agent: [compiles landing.html → landing.annotated.html, shares link]
```

The agent can also use it on its own — when it needs answers to multiple questions before continuing, it writes a JSON questionnaire and compiles it without you having to ask.

---

## Supported harnesses

| Harness | What gets installed | Location |
|---|---|---|
| **Claude Code** | Custom slash command | `.claude/commands/human-feedback.md` |
| **Cursor** (1.7+) | Agent-requested rule | `.cursor/rules/human-feedback.mdc` |
| **Codex** (CLI) | AGENTS.md section | `AGENTS.md` |
| **Hermes** (0.9+) | Skill file | `.hermes/skills/human-feedback/SKILL.md` |

**Targeted installs:**

```bash
human-feedback install --claude-code
human-feedback install --cursor --global
human-feedback install --codex
human-feedback install --hermes
human-feedback install --all              # every detected harness
```

**Verify what's installed:**

```bash
human-feedback doctor
```

**Uninstall:**

```bash
human-feedback uninstall --all
```

See [`plugins/<harness>/INSTALL.md`](plugins/) for per-harness details.

---

## How it works

1. The user types `/human-feedback` (or says "get feedback on this") in their agent chat
2. The agent identifies the artifact to compile — an HTML mockup, a markdown doc, or a JSON questionnaire
3. The agent runs `human-feedback compile <input> -o <output> --force`
4. The agent shares a `file://` link to the compiled file
5. The user opens it in a browser, annotates or responds
6. The user copies the structured prompt and pastes it back to the agent
7. The agent reads the feedback and continues

The command definition tells the agent everything it needs: when to use each tool, how to name output files, the JSON schema for questionnaires, and the expected response format.

When the agent edits the source file after the initial compile, it automatically recompiles and shares an updated link — the user always sees the latest version without asking.

### Sub-commands (Claude Code)

| Command | Description |
|---|---|
| `/human-feedback` | Default — compile and present a feedback surface |
| `/human-feedback update` | Update to the latest version and reinstall the skill |

---

## Three tools, one command

```
input file  +  embedded template  →  standalone HTML
```

| Input extension | Tool | What it produces |
|---|---|---|
| `.html` / `.htm` | **HTML Annotator** | Your page with click-to-annotate + text-selection UI |
| `.md` / `.markdown` | **Markdown Annotator** | Your markdown rendered as a preview with annotation controls |
| `.json` | **Human Feedback** | A form the human fills in; structured answers copy to clipboard |

### `human-feedback compile <input> -o <output>`

```bash
# Wrap a static HTML page with annotation controls
human-feedback compile page.html -o page.annotated.html

# Bake a markdown file into a rendered, annotatable preview
human-feedback compile docs.md -o docs-review.html

# Bake a questions JSON into a human-feedback form
human-feedback compile questions.json -o feedback.html
```

| Flag | Description |
|---|---|
| `-o, --out <file>` | Output file path (required) |
| `--tool <name>` | Override: `annotator` \| `md-annotator` \| `feedback` |
| `--force` | Overwrite output if it already exists |

### `human-feedback info <file>`

Detect which tool would be used for a file without compiling.

---

## Why this exists

The longer an agent's output gets, the worse the feedback loop becomes. A 20-line snippet is easy to comment on in chat. A 200-line spec is not. Humans end up:

- Skimming instead of reading, then giving vague feedback ("looks good but fix the header")
- Screenshotting parts and describing problems verbally, losing all machine-readable context
- Re-explaining things the agent already knows because pointing at "that paragraph" doesn't work in a chat window
- Giving up and approving work they haven't fully reviewed

The root problem: **chat is a terrible interface for reviewing long artifacts.** You need to see the whole document, point at specific parts, and have your comments land back in the agent's context with enough precision that it can act without guessing.

`human-feedback` gives you a proper review surface — outside the chat — and brings the feedback back as a structured prompt the agent can parse.

---

## Tool details

### HTML Annotator

Inlines the annotation script into any static HTML page. The human opens it and annotates elements or text directly.

**Input:** any `.html` file
**Output:** same HTML with annotator injected before `</body>`

```bash
human-feedback compile landing.html -o landing.annotated.html
```

**How the human annotates:**
- **Desktop:** hover to highlight elements, click to annotate; drag-select text for inline annotations
- **Mobile:** long-press (600ms) to annotate an element; native text selection + tap to annotate text

**Generated prompt** (copied to clipboard) references CSS selectors:
```
### Annotation #1 — Element
CSS Selector: section.hero > h2
Context: "Build faster, ship smarter"
Comment: Too vague — needs a concrete value prop
---
### Annotation #2 — Text Selection
Context: "trusted by over 12,000 teams"
Comment: Move this above the CTA button
```

### Markdown Annotator

Bakes a `.md` file into a self-contained HTML viewer. Annotations reference back to the **original markdown source with line numbers**.

**Input:** any `.md` / `.markdown` file
**Output:** `md-annotator.html` with markdown auto-loaded on open

```bash
human-feedback compile docs/api.md -o review/api-review.html
```

Generated prompt format:
```
### Annotation #1 — Block Element
Line: L4
Markdown source reference:
```markdown
## Authentication
```
Comment: Add a curl example here
```

### Human Feedback

Replaces the `QUESTIONS = null` placeholder with your JSON config. The output is a complete form the user fills in and submits — answers copy to clipboard as a structured natural-language prompt (see [Output prompt](#output-prompt) below).

**Input:** a `.json` file matching the schema below
**Output:** `feedback.html` with questions baked in

```bash
human-feedback compile sprint-questions.json -o sprint-form.html
```

#### JSON schema

```json
{
  "title": "Session title",
  "description": "Context shown to the user",
  "questions": [
    {
      "id": "q1",
      "text": "Your question here?",
      "type": "text",
      "hint": "Optional helper text",
      "required": true
    }
  ]
}
```

#### Question types

| `type` | UI rendered | Extra fields |
|---|---|---|
| `text` | Single-line input | `placeholder` |
| `textarea` | Multi-line input | `placeholder` |
| `radio` | Pick one (option buttons) | `options: string[]` |
| `checkbox` | Pick many (checkboxes) | `options: string[]` |
| `select` | Dropdown | `options: string[]` |
| `boolean` | Yes / No buttons | — |
| `scale` | Discrete numbered buttons | `min`, `max`, `minLabel`, `maxLabel` |
| `range` | Continuous slider | `min`, `max`, `step`, `unit` |
| `date` | Date picker | — |

#### Modifiers

| Field | Description |
|---|---|
| `"other": true` | Adds an "Other…" option with a free-text input (`radio`, `checkbox`, `select`) |
| `"allowImage": true` | Adds an image upload zone below the question (any type) |
| `"required": true` | Submit stays disabled until this question is answered |

#### Output prompt

When the human submits, a structured **natural-language prompt** is copied to their clipboard. The format is identical across all three tools so the agent can parse it the same way every time:

```
The user completed a questionnaire and provided the following feedback.

Source: Session title
Total items: 2
Generated: 2026-05-24T10:00:00.000Z

---

## Item 1 — Your question?
Type: textarea
Comment: The user's answer

---

## Item 2 — Another question?
Type: radio
Comment: Option A

---

Please address each item above.
```

The leading sentence varies by tool (`completed a questionnaire`, `reviewed the document`, `reviewed a draft HTML page`) so the agent knows what kind of feedback it received. Item bodies always include the relevant context (line numbers for markdown, CSS selectors for HTML, question types for forms) followed by `Comment:` with the user's input.

---

## Clipboard behavior

The framework uses a 3-tier clipboard strategy that gracefully degrades:

1. **`navigator.clipboard.writeText`** — modern API (https / localhost only)
2. **`document.execCommand('copy')`** — older fallback for some `file://` contexts
3. **Manual selection** — auto-selects the preview textarea and shows a hint like *"Press ⌘ + C to copy manually"*

This means the tools work even when opened directly via `file://` — the user just hits one keystroke to finish.

---

## Compiled file identification

Every output file starts with an HTML comment identifying it:

```html
<!-- compiled by @nsharir/human-feedback | tool: feedback | source: questions.json -->
```

Agents can read the first line of any output file to verify what they're presenting to a user.

---

## Repo structure

```
src/
├── shared/                    ← single source of truth (DRY)
│   ├── tokens.css             ← shared design tokens
│   ├── preview-dialog.html    ← reusable dialog markup
│   ├── preview-dialog.css     ← dialog styles
│   ├── clipboard.js           ← 3-tier clipboard fallback
│   ├── preview.js             ← preview controller
│   ├── toast.js / toast.css   ← toast notifications
│   └── escape-html.js         ← shared util
│
├── tools/
│   ├── annotator/             ← HTML annotator script
│   ├── md-annotator/          ← Markdown annotator HTML template
│   └── feedback/              ← Feedback form HTML template
│
plugins/                       ← Agent harness integrations
├── claude-code/               ← Slash command + INSTALL.md
├── cursor/                    ← Rule file + INSTALL.md
├── codex/                     ← AGENTS.md section + INSTALL.md
└── hermes/                    ← Skill file + INSTALL.md

build/build.js                 ← Resolves @include directives, writes templates
lib/templates/                 ← Built templates (committed)
lib/compiler.js                ← The compiler (consumes built templates)
lib/installer.js               ← Detects + installs skill definitions
bin/cli.js                     ← CLI entry point
```

---

## Build process

Sources live in `src/`. To avoid duplication, files reference shared modules via `@include` directives:

```js
/* @include shared/clipboard.js */
```

```html
<!-- @include shared/preview-dialog.html -->
```

Run the build to resolve all includes and write the final templates to `lib/templates/`:

```bash
npm run build
```

The built templates are committed to git so `npm install` works without a build step. The `prepack` script automatically rebuilds before publishing.

### Adding to a shared module

1. Edit the file in `src/shared/`
2. Run `npm run build`
3. The change applies to every tool that includes it
4. Commit both `src/` and `lib/templates/`

### Adding a new tool

1. Create `src/tools/<name>/` with HTML template + tool-specific CSS/JS
2. Use `@include` to pull in shared modules
3. Add an entry to `build/build.js`'s `targets` array
4. Add a case to `lib/compiler.js`'s `compile()` switch
5. Add file-extension detection to `detectTool()` in `lib/compiler.js`

---

## Agent workflow patterns

### HTML review loop

```
1. Agent generates or modifies an HTML page
2. User types /human-feedback (or "get feedback on the page")
3. Agent: human-feedback compile page.html -o page.annotated.html
4. Agent shares the file:// link
5. Human opens, annotates → copies prompt
6. Agent reads prompt, makes targeted edits
7. Loop repeats until approved
```

### Document review loop

```
1. Agent writes a markdown document
2. User types /human-feedback
3. Agent: human-feedback compile doc.md -o doc.review.html
4. Human opens file, annotates sections by line number
5. Agent receives prompt with line-referenced comments
6. Agent edits the specific lines and recompiles
```

### Structured intake / clarification

```
1. Agent needs information before proceeding
2. User types /human-feedback (or agent recognizes it needs input)
3. Agent writes questions.json targeting exactly what it needs
4. Agent: human-feedback compile questions.json -o intake.html
5. Human fills in the form, copies the prompt
6. Agent reads the structured prompt, extracts answers
7. Agent continues with full context — no back-and-forth
```

---

## Updating

In Claude Code, just type:

```
/human-feedback update
```

This updates the npm package and reinstalls the skill in one step.

From the terminal:

```bash
npm install -g @nsharir/human-feedback@latest && human-feedback install
```

---

## Examples

See [`examples/`](examples/) for ready-to-compile inputs.

```bash
npm run compile:examples
```

This will compile every file in `examples/` into `examples/built/`.

---

## License

[MIT](LICENSE)
