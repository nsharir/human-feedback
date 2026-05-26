# Claude Code — `/human-feedback` command

## Automatic install

First install the `human-feedback` CLI (one-time, ~10 seconds):

```bash
curl -fsSL https://raw.githubusercontent.com/nsharir/human-feedback/main/install.sh | bash
```

Then install the Claude Code plugin:

```bash
human-feedback install --claude-code
```

This writes `.claude/commands/human-feedback.md` in your project. Add `--global` to install at `~/.claude/commands/` instead.

## Uninstall

```bash
human-feedback uninstall --claude-code
```

## What gets installed

A single markdown file at `.claude/commands/human-feedback.md` — a custom slash command the user invokes with `/human-feedback` in Claude Code.

The command teaches the agent to:

1. Identify the artifact that needs feedback (from user input or recent context)
2. Run `human-feedback compile <input> -o <output> --force`
3. Present the compiled file via Claude Preview or a `file://` link
4. Wait for the user's structured feedback

## Usage

In Claude Code, type:

```
/human-feedback
```

Or with a specific request:

```
/human-feedback review the mockup I just created
```

## Manual install

Copy `human-feedback.command.md` from this directory to `.claude/commands/human-feedback.md`.

## Upgrading from v1.x

Running `install` automatically removes old hook-based entries from `.claude/settings.json`. Run `doctor` to check:

```bash
human-feedback doctor
```

## Requires

- Node.js 18+ on PATH
- `human-feedback` CLI installed (see *Automatic install* above)
