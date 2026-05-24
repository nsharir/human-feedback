# Cursor plugin

Installs an `afterFileEdit` hook into Cursor (1.7+) that automatically wraps any `.md` / `.html` / `.json` file the agent writes with the **agent-feedback framework**.

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
        "command": "afb __hook",
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
2. Checks if it's a `.md`, `.html`, or `.json` file (skips already-wrapped files and config files)
3. Runs `afb compile <file> -o <file>.{review,annotated,feedback}.html --force`
4. Returns an `agentMessage` telling the agent to share the wrapped file with the user

## Manual install

Add this to `.cursor/hooks.json`:

```json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [
      { "command": "afb __hook", "timeout": 20 }
    ]
  }
}
```

Restart Cursor. Check the Hooks settings tab to confirm.

## Requires

- Cursor 1.7 or later
- Node.js 18+ on PATH
- `@nsharir/agent-feedback` installed globally (`npm install -g @nsharir/agent-feedback`)
