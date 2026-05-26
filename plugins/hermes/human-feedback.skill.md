---
name: human-feedback
version: "2.1.0"
description: "Compile HTML, Markdown, or JSON artifacts into interactive feedback surfaces. Use when the user asks for feedback on a mockup, spec, plan, or questionnaire."
tags: [feedback, review, annotate, questionnaire, human-in-the-loop]
---
<!-- human-feedback v2.1.0 -->
# human-feedback

Compile an artifact into an interactive feedback surface the user opens in a browser.

## When to use

Use this when the user asks for feedback on something you produced, or when you need structured input from the user. The user may say "human-feedback", "get feedback on this", "let me review that", or similar.

## Determine what to compile

1. If the user specified a file or described what needs feedback, use that.
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

Write the output file under the active workspace's plans directory when appropriate:
`<workspace>/.hermes/plans/<output-filename>`

where `<workspace>` is the absolute path from the most recent `[Workspace::v1: /abs/path]` tag on the user's message. Create the directory if it does not exist.

Run:

```
human-feedback compile <input-path> -o <output-path> --force
```

## Present the result

Include both a `file://` link and a `MEDIA:` token in your reply so the WebUI embeds it inline:

```
file://<absolute-output-path>
MEDIA:<absolute-output-path>
```

Tell the user the feedback surface is ready and **wait for their response**. Do not continue with work that depends on their feedback until they paste the structured prompt back.

## Keep the link up to date

After the initial compile, **every time you edit the source file** (the `.md`, `.html`, or `.json` that was compiled), you MUST immediately recompile by running the same `human-feedback compile` command again with `--force`. Then share the updated `file://` link (and `MEDIA:` token if applicable) so the user always sees the latest version. Do not wait for the user to ask — recompile proactively whenever you modify the source.

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

## Updating human-feedback

If the user asks to "update human-feedback" or "update to latest", run:

```
human-feedback update
```

This pulls the latest from GitHub, reinstalls dependencies, and rebuilds the templates. Report the new version (`human-feedback --version`) when it finishes.

## Version check

After running any `human-feedback` CLI command, inspect its output for a line matching:

```
[human-feedback:update-available current=X.Y.Z latest=A.B.C]
```

If you see this marker, surface a single one-liner to the user alongside your normal response:

> _human-feedback v{latest} is available (you're on {current}). Run `human-feedback update` or ask me to update it for you._

Only mention this **once per conversation**. Do not repeat the notice on subsequent invocations in the same session. Do not poll proactively — only react to the marker emitted by the CLI itself.
