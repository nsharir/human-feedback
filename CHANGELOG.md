# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] — 2026-05-25

Initial public release of `@nsharir/human-feedback` under its new name and versioning.

### Architecture — slash-command-driven

- The agent invokes `/human-feedback` explicitly. No hooks, no rule injection, no managed `MEMORY.md` entries.
- The installer writes a command/skill definition for each supported harness:
  - Claude Code: `.claude/commands/human-feedback.md`
  - Cursor: `.cursor/rules/human-feedback.mdc`
  - Codex: `AGENTS.md` section (marked with `<!-- human-feedback:begin/end -->`)
  - Hermes: `.hermes/skills/human-feedback/SKILL.md`
- Core compile engine (`lib/compiler.js`) wraps `.md` / `.html` / `.json` files into interactive feedback surfaces.
- `human-feedback doctor` validates the install and warns about legacy hook configs left over from earlier prototypes.
