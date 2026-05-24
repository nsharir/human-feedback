# Cursor plugin

Installs an `afterFileEdit` hook into Cursor (1.7+) that automatically wraps any `.md` / `.html` file the agent writes with the **agent-feedback framework**. `.json` files are intentionally NOT wrapped — they're reserved for the questionnaire workflow (see the [Agent contract](../../README.md#agent-contract-questionnaires)).

## Install (recommended)

```bash
npx @nsharir/agent-feedback install --cursor
```

This patches `.cursor/hooks.json` in your project. Add `--global` to install at `~/.cursor/hooks.json` instead.

## Uninstall

```bash
npx @nsharir/agent-feedback uninstall --cursor
```

## What gets added

```json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [
      {
        "__agent_feedback_managed__": true,
        "command": "agent-feedback __hook",
        "timeout": 20
      }
    ]
  }
}
```

The `__agent_feedback_managed__` marker is used by the uninstaller to find and remove only the hook it added.

## What the hook does

After every Cursor file edit:
1. Reads the file path from the event
2. Checks if it's a `.md` or `.html` file (skips already-wrapped files). `.json` files are skipped entirely — see [Agent contract](../../README.md#agent-contract-questionnaires).
3. Runs `agent-feedback compile <file> -o <file>.{review,annotated,feedback}.html --force`
4. Returns an `agentMessage` telling the agent to share the wrapped file with the user

## Manual install

Add this to `.cursor/hooks.json`:

```json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [
      { "command": "agent-feedback __hook", "timeout": 20 }
    ]
  }
}
```

Restart Cursor. Check the Hooks settings tab to confirm.

## Requires

- Cursor 1.7 or later
- Node.js 18+ on PATH
- `@nsharir/agent-feedback` installed globally (`npm install -g @nsharir/agent-feedback`)
