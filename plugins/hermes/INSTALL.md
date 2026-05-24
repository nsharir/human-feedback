# Hermes — agent-feedback skill

## Automatic install

```bash
npx @nsharir/agent-feedback install --hermes
```

This writes `.hermes/skills/agent-feedback/SKILL.md` in your project. Add `--global` to install at `~/.hermes/skills/agent-feedback/` instead.

## Uninstall

```bash
npx @nsharir/agent-feedback uninstall --hermes
```

## What gets installed

A single skill file at `.hermes/skills/agent-feedback/SKILL.md` that teaches the agent to:

1. Identify the artifact that needs feedback
2. Run `agent-feedback compile <input> -o <output> --force`
3. Write output under `<workspace>/.hermes/plans/` when appropriate
4. Include both a `file://` link and a `MEDIA:` token in the reply (WebUI renders it inline)
5. Wait for the user's structured feedback

## Usage

In Hermes, say:

```
/agent-feedback
```

Or:

```
get feedback on the mockup
```

## Manual install

Copy `agent-feedback.skill.md` from this directory to `.hermes/skills/agent-feedback/SKILL.md`.

## Upgrading from v1.x

Running `install` automatically removes the old Python plugin directory (`.hermes/plugins/agent_feedback/`) and the managed `MEMORY.md` entry.

## Requires

- Hermes Agent 0.9 or later
- Node.js 18+ on PATH
- `@nsharir/agent-feedback` installed globally (`npm install -g @nsharir/agent-feedback`)
