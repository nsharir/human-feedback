<!-- human-feedback:begin v2.1.0 -->
## human-feedback

When the user asks for feedback on an artifact, or says "human-feedback", compile it into an interactive feedback surface.

### Determine what to compile

1. If the user specified a file or described what needs feedback, use that.
2. Otherwise, find the most recent artifact you produced (HTML mockup, markdown spec/plan, or a situation needing structured user input).

### Input types

| Situation | What to do |
|-----------|-----------|
| You wrote an `.html` file | That file is the input — becomes an annotatable page |
| You wrote a `.md` file | That file is the input — becomes a rendered review surface |
| You need to ask ≥2 questions | Write a `questions.json` file first (schema below), then compile it |
| The user pointed at a specific file | Use that file |

### Compile

Output filename convention:
- `.html` / `.htm` → `<stem>.annotated.html`
- `.md` / `.markdown` → `<stem>.review.html`
- `.json` → `<stem>.feedback.html`

```
human-feedback compile <input-path> -o <output-path> --force
```

### Present the result

Share: `file://<absolute-output-path>`

Wait for the user's response. Do not continue with dependent work until they paste back the structured feedback prompt.

### Keep the link up to date

After the initial compile, **every time you edit the source file** (the `.md`, `.html`, or `.json` that was compiled), you MUST immediately recompile by running the same `human-feedback compile` command again with `--force`. Then share the updated `file://` link so the user always sees the latest version. Do not wait for the user to ask — recompile proactively whenever you modify the source.

### JSON questionnaire schema

```json
{
  "title": "Short title",
  "description": "Context paragraph",
  "questions": [
    { "id": "q1", "text": "Question?", "type": "text" },
    { "id": "q2", "text": "Pick one?", "type": "radio", "options": ["A", "B"] },
    { "id": "q3", "text": "Select all?", "type": "checkbox", "options": ["X", "Y"] },
    { "id": "q4", "text": "Yes or no?", "type": "boolean" },
    { "id": "q5", "text": "Rate 1-10?", "type": "scale", "min": 1, "max": 10 }
  ]
}
```

Types: `text`, `textarea`, `radio`, `checkbox`, `select`, `boolean`, `scale`, `range`, `date`. Add `"other": true` for free-text option, `"required": true` for mandatory questions.

### Updating human-feedback

If the user asks to update human-feedback, run `human-feedback update` — it pulls the latest from GitHub and rebuilds.

### Version check

After running any `human-feedback` CLI command, inspect its output for a line matching `[human-feedback:update-available current=X.Y.Z latest=A.B.C]`. If found, surface a single one-liner to the user **once per conversation**:

> _human-feedback v{latest} is available (you're on {current}). Run `human-feedback update` or ask me to update it for you._

Do not poll proactively — only react to the marker emitted by the CLI.
<!-- human-feedback:end -->
