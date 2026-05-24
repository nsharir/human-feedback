# Codex — agent-feedback in AGENTS.md

## Automatic install

```bash
npx @nsharir/agent-feedback install --codex
```

This appends a marked section to `AGENTS.md` in your project. Add `--global` to install at `~/AGENTS.md` instead.

## Uninstall

```bash
npx @nsharir/agent-feedback uninstall --codex
```

## What gets installed

A section in `AGENTS.md` wrapped in `<!-- agent-feedback:begin -->` / `<!-- agent-feedback:end -->` markers. Existing content in `AGENTS.md` is preserved. Uninstall removes only the marked section.

The section instructs the agent to:

1. Identify the artifact that needs feedback
2. Run `agent-feedback compile <input> -o <output> --force`
3. Share a `file://` link to the compiled output
4. Wait for the user's structured feedback

## Usage

In Codex, say:

```
use agent-feedback to review the spec
```

## Manual install

Copy the content of `agent-feedback.agents-section.md` from this directory and paste it into your `AGENTS.md`.

## Upgrading from v1.x

Running `install` automatically removes old hook-based entries from `.codex/hooks.json`.

## Requires

- Node.js 18+ on PATH
- `@nsharir/agent-feedback` installed globally (`npm install -g @nsharir/agent-feedback`)
