<!-- agent-feedback:begin v2.0.0 -->
## agent-feedback

When the user asks for feedback on an artifact, or says "agent-feedback", compile it into an interactive feedback surface.

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
agent-feedback compile <input-path> -o <output-path> --force
```

### Present the result

Share: `file://<absolute-output-path>`

Wait for the user's response. Do not continue with dependent work until they paste back the structured feedback prompt.

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
<!-- agent-feedback:end -->
