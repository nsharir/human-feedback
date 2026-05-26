# Changelog

All notable changes to this project will be documented in this file.

## [0.2.2] — 2026-05-26

No-op version bump for end-to-end update-flow testing.

## [0.2.1] — 2026-05-26

### Fixed

- `install.sh`: brace-quote `${HOME_DIR}` and `${BIN_DIR}` expansions before the ellipsis character so bash doesn't treat U+2026 as part of the variable name (under `set -u` this aborted every fresh install with `unbound variable`).

## [0.2.0] — 2026-05-26

### Added

- **`install.sh` bootstrap script** — install via `curl -fsSL https://raw.githubusercontent.com/nsharir/human-feedback/main/install.sh | bash`. Clones the repo to `~/.human-feedback`, builds templates, and symlinks the CLI to `~/.local/bin/human-feedback`. No npm publishing required.
- **`human-feedback update`** — pulls the latest from GitHub, reinstalls runtime deps, and rebuilds templates. Detects whether the install is `install.sh`-managed; falls back to a helpful hint for dev clones. Supports `--dry-run` and `--ref <ref>`.
- **`human-feedback check-for-updates`** — checks the GitHub Releases API for a newer version (falls back to tags). Aliases: `check-updates`, `check`.
- **Automatic version-check on every CLI invocation** — once per session (PPID-scoped) and 24h disk-cached at `~/.cache/human-feedback/version-check.json`. When outdated, prints a boxed banner to stderr and a machine-readable marker (`[human-feedback:update-available current=X latest=Y]`) to stdout so agents can surface the notice. Skipped automatically for `update`, `check-for-updates`, `--help`, `--version`, and `uninstall`. Disabled via `HUMAN_FEEDBACK_NO_UPDATE_CHECK=1`, `NO_UPDATE_NOTIFIER=1`, or `CI=true`.
- **Version-check + update flow in all four plugin skills** (Claude Code, Cursor, Codex, Hermes) — agents now react to the update marker and can run `human-feedback update` on the user's behalf.
- `test/version-check.js` — 24 tests with a mock GitHub API.

### Changed

- **Distribution channel: GitHub instead of npm.** The package is no longer published to the npm registry. All `INSTALL.md` files and the README now point at `install.sh` and `human-feedback install` instead of `npx @nsharir/human-feedback ...`.
- Plugin skill files bumped to `v2.1.0`.

### Fixed

- Preview dialog (shared across all 3 tools) no longer hides its Copy / Reset buttons on short viewports — was caused by a 320px textarea `min-height` colliding with `overflow: hidden`. Now uses `flex-shrink: 0` on header/footer and a 120px textarea minimum, with extra breakpoints for `max-height: 640px` and `max-width: 480px`.
- Annotation side panel and comment popover now behave as a bottom sheet on narrow desktop windows (≤720px wide), not just on touch devices.
- Feedback questionnaire tightened for phone-width screens (≤480px and ≤360px breakpoints).
- Feedback artifact title renamed from `Agent Feedback` to `Human Feedback`.

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
