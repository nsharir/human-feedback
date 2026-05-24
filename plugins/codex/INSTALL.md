# Codex plugin

Installs a `PostToolUse` hook into Codex CLI that automatically wraps any `.md` / `.html` / `.json` file the agent writes with the **agent-feedback framework**.

## Install (recommended)

```bash
npx @nsharir/agent-feedback install --codex
```

This patches `.codex/hooks.json` in your project. Add `--global` to install at `~/.codex/hooks.json` instead.

## Uninstall

```bash
npx @nsharir/agent-feedback uninstall --codex
```

## What gets added

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "^(Write|Edit|apply_patch|create_file|str_replace)$",
        "__agent_feedback_managed__": true,
        "hooks": [
          { "type": "command", "command": "afb __hook", "timeout": 20 }
        ]
      }
    ]
  }
}
```

## What the hook does

After every Codex write/edit/patch tool call:
1. Reads the file path from `tool_input`
2. Checks if it's a `.md`, `.html`, or `.json` file
3. Runs `afb compile <file> -o <file>.{review,annotated,feedback}.html --force`
4. Returns an `additionalContext` so the agent shares the wrapped file with the user

## Manual install

Add the JSON above to `.codex/hooks.json`. You can also configure inline in `config.toml`:

```toml
[[hooks.PostToolUse]]
matcher = "^(Write|Edit|apply_patch|create_file|str_replace)$"

[[hooks.PostToolUse.hooks]]
type    = "command"
command = "afb __hook"
timeout = 20
```

Restart Codex. Verify with `codex hooks` (lists active hooks).

## Trust requirements

Codex requires project-local hooks to be **trusted** before they run. After installing, you'll be prompted on first use to trust `afb __hook`. Approve it to enable the hook.
