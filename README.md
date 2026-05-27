# human-feedback

**The agent isn't slow. *Delivering the feedback back to the agent* is what's killing you.**

You're reading a spec and trying to describe *which paragraph* you disagree with. You're staring at a mockup and typing "the button in the top-right of the second row" because there's no other way to point. You're answering "just a few clarifying questions" for the fourth time today.

`human-feedback` fixes this. It turns any agent output — a markdown spec, an HTML mockup, a list of questions, or even just a long text message — into a reviewable, annotatable artifact you open in your browser. You highlight, click, comment, and then copy a structured prompt back. The agent knows exactly which line, which element, which answer each comment refers to.

No server. No accounts. No browser extension. Just a single command: `/human-feedback`.

---

## See it in action

**End-to-end walkthrough** — from intent capture to mockup feedback, with narration:

https://github.com/user-attachments/assets/73058dc7-7a15-4014-b69a-ef864e024e79

### The agent asks you what you want

You know how it goes: the agent dumps a long message with a dozen questions for you to respond to. You just reply with `/human-feedback` — it generates a full-blown questionnaire for you to easily respond to every question. Fill it in, click copy, paste it back.

![Feedback questioner demo](examples/demos/feedback.gif)

### The agent drafts a spec

The agent writes markdown — or even worse, sends you an inline message with a specification in place. Struggling to provide feedback on different sections of the text is painfully time-consuming. Same command: `/human-feedback`. It restructures the spec into a reviewable artifact with a comment layer baked in. Highlight any sentence, type a comment, get floating labels in the text. Click "Copy Prompt" and hand the agent a structured response: *which line, what it said, what you want changed.*

![Markdown annotator demo](examples/demos/md-annotator.gif)

### The agent ships a UI mockup

The agent renders HTML — but describing what to fix spatially ("the button at the left side panel, on the top") is a nightmare. Same command: `/human-feedback`. Click on any element, leave a comment, and the CSS selector goes with it. The agent sees exactly what you were pointing at.

![HTML annotator demo](examples/demos/html-annotator.gif)

### The agent just... responds with text

The agent doesn't need to have written a file. If it just replied with a long text message — an analysis, a list of recommendations, a draft email — invoke `/human-feedback` and the agent will take its own response, save it as an artifact, and compile it into a reviewable surface on the spot. Any textual agent output becomes a human-reviewable artifact.

### Try the samples yourself

Download these and open them in your browser to see what each tool produces:

- [Questionnaire — Requirements Discovery](https://github.com/user-attachments/files/28198417/email-client-requirements.feedback.html) (structured Q&A form)
- [Markdown Annotator — Functional Spec](https://github.com/user-attachments/files/28198418/email-client-spec.review.html) (rendered spec with comment layer)
- [HTML Annotator — UI Mockup](https://github.com/user-attachments/files/28198419/email-client-mockup.annotated.html) (click-to-annotate prototype)

---

## Quick start

Just tell your agent to set it up:

```
Please install https://github.com/nsharir/human-feedback
```

> **For agents:** after running the installer (`curl … | bash`), do **not** silently pick a harness or scope. Ask the user:
> 1. **Scope** — install **globally** (`~/.<harness>/…`, available in every project) or **project-local** (this repo only)?
> 2. **Harnesses** — which of the detected ones to wire up: Claude Code, Cursor, Codex, Hermes, or `--all`?
>
> Then run the matching `human-feedback install --<harness> [--global]` command(s). Use `human-feedback doctor` to confirm.

Or install manually:

```bash
curl -fsSL https://raw.githubusercontent.com/nsharir/human-feedback/main/install.sh | bash
human-feedback install   # interactive — pick your harness
```

The installer clones the repo to `~/.human-feedback`, builds the templates, and symlinks the CLI to `~/.local/bin/human-feedback`. No npm package — installs and updates come straight from GitHub.

Note: most tools require a new session for the command and skill to take effect.

Next time the agent produces anything you need to review, just type:

```
/human-feedback
```

It will do the magic, with no further instructions needed. The agent automatically picks up the latest artifact it produced, compiles it into a reviewable format, and hands you a link.

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

## Releasing

Releases are published automatically by `.github/workflows/release.yml` whenever a tag matching `v*` is pushed. The workflow extracts the matching section from `CHANGELOG.md` and creates a GitHub Release using the built-in `GITHUB_TOKEN` (no PAT required).

### Cutting a new release

1. **Bump the version** in `package.json` and `package-lock.json` (both `"version"` occurrences for this package — leave nested deps alone).
2. **Add a CHANGELOG entry** at the top:
   ```markdown
   ## [X.Y.Z] — YYYY-MM-DD

   ### Added / Changed / Fixed

   - ...
   ```
   The version inside the brackets must match the tag (the workflow verifies this and fails the run if they diverge).
3. **Commit and push `main`**:
   ```bash
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "vX.Y.Z: <short summary>"
   git push origin main
   ```
4. **Tag and push the tag**:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```
5. The release workflow fires on the tag push. Watch it with:
   ```bash
   gh run list --repo nsharir/human-feedback --workflow=release.yml --limit 3
   ```
6. Once it completes, the release is live at `https://github.com/nsharir/human-feedback/releases/tag/vX.Y.Z`. Clients running `human-feedback check-for-updates` (or any CLI command, which auto-checks once per session) will see the new version within 24 hours of cache expiry.

### What the workflow does

| Step | Action |
|------|--------|
| 1 | Checks out the repo at the tagged commit |
| 2 | Extracts the version from the tag (`v1.2.3` → `1.2.3`) |
| 3 | Verifies `package.json` version matches the tag — fails the run on mismatch |
| 4 | Awk-extracts the matching `## [X.Y.Z]` section from `CHANGELOG.md` into `release-notes.md` |
| 5 | Runs `gh release create vX.Y.Z --notes-file release-notes.md` |

### Notes

- **The tag IS the trigger.** No commit-message flag or manual step needed. Pushing the tag is the single action that publishes the release.
- **The notes come from CHANGELOG.md.** If you forget the changelog entry the workflow falls back to a generic "See CHANGELOG.md for details" placeholder — fix it by editing the release on GitHub or by retagging.
- **Retagging a published version:** delete the local + remote tag, then push the new tag. The workflow runs again and the release is recreated.
  ```bash
  git tag -d vX.Y.Z
  git push origin :refs/tags/vX.Y.Z
  gh release delete vX.Y.Z --repo nsharir/human-feedback --yes
  git tag -a vX.Y.Z -m "vX.Y.Z"
  git push origin vX.Y.Z
  ```
- **Notes with backticks render fine** because we use `--notes-file` rather than interpolating into the shell.

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

This pulls the latest from GitHub and rebuilds the templates in one step.

From the terminal:

```bash
human-feedback update
```

To check whether a new version is available without updating:

```bash
human-feedback check-for-updates
```

The CLI also prints an `[human-feedback:update-available current=X latest=Y]` marker once per session when an update is available, so the agent can mention it to you.

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
