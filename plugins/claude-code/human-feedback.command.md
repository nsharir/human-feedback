<!-- human-feedback v2.1.1 -->
# /human-feedback

Compile an artifact into an interactive feedback surface the user opens in a browser.

## Sub-commands

Check `$ARGUMENTS` first. If it matches a sub-command below, run that instead of the default compile flow.

| `$ARGUMENTS` | Action |
|---|---|
| `update` | Run the update flow (see below) |
| anything else | Continue to the compile flow |

### `/human-feedback update`

Update the human-feedback installation to the latest version:

```
human-feedback update
```

This pulls the latest from GitHub, reinstalls dependencies, and rebuilds the templates. After it succeeds, report the new version (`human-feedback --version`). Then stop — do not compile anything.

If `human-feedback update` reports that the install is not managed by `install.sh`, fall back to the manual instructions it prints (typically a `git pull` in a dev clone).

---

## When the user invokes this command (default compile flow)

Determine what needs feedback:

1. If `$ARGUMENTS` is provided (and is not a sub-command above), use it to identify the file or describe what to compile.
2. Otherwise, look at your recent conversation — find the most recent artifact you produced (an HTML mockup, a markdown spec/plan, or a situation where you need to ask the user multiple structured questions).

## Identify the input

| Situation | What to do |
|-----------|-----------|
| You wrote an `.html` file | That file is the input — it becomes an annotatable page |
| You wrote a `.md` file | That file is the input — it becomes a rendered review surface |
| You need to ask the user ≥2 questions | Write a `questions.json` file first (schema below), then compile it |
| The user pointed at a specific file | Use that file |

## Compile

Pick an output filename based on the input extension:

- `.html` / `.htm` input → `<stem>.annotated.html`
- `.md` / `.markdown` input → `<stem>.review.html`
- `.json` input → `<stem>.feedback.html`

Run:

```
human-feedback compile <input-path> -o <output-path> --force
```

## Present the result

Share the compiled file with the user as a clickable `file://` link **and** offer to open it for them:

```
file://<absolute-output-path>
```

Then explicitly suggest opening it. On macOS, propose running:

```
open <absolute-output-path>
```

(On Linux use `xdg-open`, on Windows use `start`.) If the user confirms — or has previously told you to just open artifacts automatically — run the command. Otherwise leave the link for them to click.

If Claude Preview is available, also show it inline:
1. `mcp__Claude_Preview__preview_start` with the file path
2. `mcp__Claude_Preview__preview_screenshot` to display it

Tell the user the feedback surface is ready and **wait for their response**. Do not continue with work that depends on their feedback until they paste the structured prompt back.

## Keep the link up to date

After the initial compile, **every time you edit the source file** (the `.md`, `.html`, or `.json` that was compiled), you MUST immediately recompile by running the same `human-feedback compile` command again with `--force`. Then share the updated `file://` link (or refresh the Claude Preview) so the user always sees the latest version. Do not wait for the user to ask — recompile proactively whenever you modify the source.

## JSON questionnaire schema

When you need to ask the user multiple questions, write a `.json` file:

```json
{
  "title": "Short title",
  "description": "Context paragraph",
  "questions": [
    { "id": "q1", "text": "Question?", "type": "text", "hint": "optional helper" },
    { "id": "q2", "text": "Pick one?", "type": "radio", "options": ["A", "B"] },
    { "id": "q3", "text": "Select all?", "type": "checkbox", "options": ["X", "Y"] },
    { "id": "q4", "text": "Yes or no?", "type": "boolean" },
    { "id": "q5", "text": "Rate 1-10?", "type": "scale", "min": 1, "max": 10 }
  ]
}
```

Supported types: `text`, `textarea`, `radio`, `checkbox`, `select`, `boolean`, `scale`, `range`, `date`.

- `radio`, `checkbox`, `select` require an `options` array
- Add `"other": true` to include a free-text "Other…" option (on by default)
- Add `"required": true` to make a question mandatory

## User response format

When the user pastes their response, it is a structured free-text prompt starting with "The user completed/reviewed/annotated…" — each `## Item N` section has their comment plus context (CSS selectors for HTML, line numbers for markdown, question types for forms).

## Version check

After running any `human-feedback` CLI command, inspect its output for a line matching:

```
[human-feedback:update-available current=X.Y.Z latest=A.B.C]
```

If you see this marker, surface a single one-liner to the user alongside your normal response:

> _human-feedback v{latest} is available (you're on {current}). Run `/human-feedback update` or ask me to update it for you._

Only mention this **once per conversation**. Do not repeat the notice on subsequent invocations in the same session. Do not poll proactively — only react to the marker emitted by the CLI itself.
