# Claude Code plugin

Installs a `PostToolUse` hook into Claude Code that automatically wraps any `.md` / `.html` / `.json` file the agent writes with the **agent-feedback framework**.

## Install (recommended)

```bash
npx @nsharir/agent-feedback install --claude-code
```

This patches `.claude/settings.json` in your project. Add `--global` to install at `~/.claude/settings.json` instead.

## Uninstall

```bash
npx @nsharir/agent-feedback uninstall --claude-code
```

## What gets added

The installer appends a single hook entry to your existing `settings.json`, preserving any other configuration:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|NotebookEdit|Create",
        "__agent_feedback_managed__": true,
        "hooks": [
          { "type": "command", "command": "agent-feedback __hook", "timeout": 20 }
        ]
      }
    ]
  }
}
```

The `__agent_feedback_managed__` marker lets the uninstaller find and remove this hook without touching anything else you've added.

## What the hook does

After every `Write` / `Edit` / `MultiEdit` / `Create` tool call:
1. Reads the file path from the event
2. Checks if it's a `.md`, `.html`, or `.json` file (skips `.review.html` / `.feedback.html` / `.annotated.html` to avoid loops, and config files like `package.json` / `tsconfig.json`)
3. Runs `agent-feedback compile <file> -o <file>.{review,annotated,feedback}.html --force`
4. Returns an `additionalContext` to the agent telling it to share the wrapped file with the user instead of the raw source

## Manual install

If the automatic installer can't run, add this to `.claude/settings.json` by hand:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|NotebookEdit|Create",
        "hooks": [
          { "type": "command", "command": "agent-feedback __hook", "timeout": 20 }
        ]
      }
    ]
  }
}
```

Restart Claude Code. Verify with `/hooks` to see the new hook listed.

## Disabling without uninstalling

Set the env var:

```bash
export AGENT_FEEDBACK_DISABLED=1
```

The hook will still fire but will short-circuit immediately.
