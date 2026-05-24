# Hermes plugin

Installs a `post_tool_call` plugin into Hermes that automatically wraps any `.md` / `.html` / `.json` file the agent writes with the **agent-feedback framework**.

## Install (recommended)

```bash
npx @nsharir/agent-feedback install --hermes
```

This copies the Python plugin into `.hermes/plugins/agent_feedback/`. Add `--global` to install into `~/.hermes/plugins/agent_feedback/` instead.

## Uninstall

```bash
npx @nsharir/agent-feedback uninstall --hermes
```

## What gets installed

A Python plugin folder at `<scope>/.hermes/plugins/agent_feedback/`:

```
agent_feedback/
├── __init__.py     ← plugin entry point with post_tool_call hook
├── plugin.json     ← plugin manifest
└── .agent_feedback_managed   ← marker for the uninstaller
```

## What the hook does

After every Hermes write/edit/create tool call:
1. The Python plugin reads the file path from the tool's arguments
2. Invokes the shared Node hook script via `agent-feedback __hook`
3. Receives the structured message and returns it to Hermes as a `system_message` injected into the next LLM call

## Manual install

Copy the `plugins/hermes/agent_feedback/` directory from this repo into `~/.hermes/plugins/`.

```bash
cp -r plugins/hermes/agent_feedback ~/.hermes/plugins/
```

Restart Hermes. Verify with `hermes plugins list` (should show `agent_feedback`).

## Requires

- Hermes Agent 0.9 or later (lifecycle hooks released April 2026)
- Python 3.10+ (Hermes' baseline)
- Node.js 18+ on PATH
- `@nsharir/agent-feedback` installed globally
