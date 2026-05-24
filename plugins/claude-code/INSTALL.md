# Claude Code — `/agent-feedback` command

## Automatic install

```bash
npx @nsharir/agent-feedback install --claude-code
```

This writes `.claude/commands/agent-feedback.md` in your project. Add `--global` to install at `~/.claude/commands/` instead.

## Uninstall

```bash
npx @nsharir/agent-feedback uninstall --claude-code
```

## What gets installed

A single markdown file at `.claude/commands/agent-feedback.md` — a custom slash command the user invokes with `/agent-feedback` in Claude Code.

The command teaches the agent to:

1. Identify the artifact that needs feedback (from user input or recent context)
2. Run `agent-feedback compile <input> -o <output> --force`
3. Present the compiled file via Claude Preview or a `file://` link
4. Wait for the user's structured feedback

## Usage

In Claude Code, type:

```
/agent-feedback
```

Or with a specific request:

```
/agent-feedback review the mockup I just created
```

## Manual install

Copy `agent-feedback.command.md` from this directory to `.claude/commands/agent-feedback.md`.

## Upgrading from v1.x

Running `install` automatically removes old hook-based entries from `.claude/settings.json`. Run `doctor` to check:

```bash
npx @nsharir/agent-feedback doctor
```

## Requires

- Node.js 18+ on PATH
- `@nsharir/agent-feedback` installed globally (`npm install -g @nsharir/agent-feedback`)
