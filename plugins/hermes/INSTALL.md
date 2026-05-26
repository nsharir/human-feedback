# Hermes — human-feedback skill

## Automatic install

First install the `human-feedback` CLI (one-time, ~10 seconds):

```bash
curl -fsSL https://raw.githubusercontent.com/nsharir/human-feedback/main/install.sh | bash
```

Then install the Hermes plugin:

```bash
human-feedback install --hermes
```

This writes `.hermes/skills/human-feedback/SKILL.md` in your project. Add `--global` to install at `~/.hermes/skills/human-feedback/` instead.

## Uninstall

```bash
human-feedback uninstall --hermes
```

## What gets installed

A single skill file at `.hermes/skills/human-feedback/SKILL.md` that teaches the agent to:

1. Identify the artifact that needs feedback
2. Run `human-feedback compile <input> -o <output> --force`
3. Write output under `<workspace>/.hermes/plans/` when appropriate
4. Include both a `file://` link and a `MEDIA:` token in the reply (WebUI renders it inline)
5. Wait for the user's structured feedback

## Usage

In Hermes, say:

```
/human-feedback
```

Or:

```
get feedback on the mockup
```

## Manual install

Copy `human-feedback.skill.md` from this directory to `.hermes/skills/human-feedback/SKILL.md`.

## Requires

- Hermes Agent 0.9 or later
- Node.js 18+ on PATH
- `human-feedback` CLI installed (see *Automatic install* above)
