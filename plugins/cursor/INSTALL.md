# Cursor — human-feedback rule

> **Agent installing this?** Run `human-feedback help-agents` first — it
> prints the canonical install playbook (scope + harness questions you
> must ask the user before picking any defaults).

## Automatic install

First install the `human-feedback` CLI (one-time, ~10 seconds):

```bash
curl -fsSL https://raw.githubusercontent.com/nsharir/human-feedback/main/install.sh | bash
```

Then install the Cursor plugin:

```bash
human-feedback install --cursor
```

This writes `.cursor/rules/human-feedback.mdc` in your project. Add `--global` to install at `~/.cursor/rules/` instead.

## Uninstall

```bash
human-feedback uninstall --cursor
```

## What gets installed

A single `.mdc` rule file at `.cursor/rules/human-feedback.mdc`. The rule has `alwaysApply: false`, so Cursor only activates it when relevant (when the user mentions feedback, review, annotation, etc.).

The rule teaches the agent to:

1. Identify the artifact that needs feedback
2. Run `human-feedback compile <input> -o <output> --force`
3. Share a `file://` link to the compiled output
4. Wait for the user's structured feedback

## Usage

In Cursor, say:

```
use human-feedback to get feedback on the page I just made
```

## Manual install

Copy `human-feedback.rule.mdc` from this directory to `.cursor/rules/human-feedback.mdc`.

## Upgrading from v1.x

Running `install` automatically removes old hook-based entries from `.cursor/hooks.json`.

## Requires

- Cursor 1.7 or later
- Node.js 18+ on PATH
- `human-feedback` CLI installed (see *Automatic install* above)
