# Changelog

All notable changes to this project will be documented in this file.

## [0.3.1] — 2026-05-28

### Changed

- **CLI plugins (claude-code, cursor, codex): explicitly suggest opening the compiled file.** The agent now shares the `file://` link **and** proposes running `open <path>` (macOS) / `xdg-open` (Linux) / `start` (Windows), and opens it on confirm. Previously the link was shared but the user had to manually click — friction Nadav flagged in Claude CLI.
- Plugin marker comments bumped to `v2.1.1` in the three CLI plugin files. Hermes plugin unchanged (WebUI uses inline `MEDIA:` embed, no `open` needed).

## [0.3.0] — 2026-05-28

### Changed

- **Distribution: ship a pre-bundled CLI.** `bin/cli.bundled.js` (~153 KB, built via esbuild) is now committed to git. The bootstrap installer (`curl … | bash`) clones the repo and symlinks the bundled file directly — **no `npm install`, no `npm run build` runs on the user's machine**. Prereqs shrink to `git` + `node 18+`.
- `install.sh`: replace the generic "Next steps" footer with a clearly-delimited **`AGENT NEXT STEPS`** block (plus a separate "Human next steps" block). A harness running `curl … | bash` now sees the install playbook in stdout without needing to fetch any doc — fixes the chicken-and-egg gap where Codex previously had no playbook to follow until *after* `install --codex` succeeded.
- README quick-start, `CONTRIBUTING.md`, and every `plugins/<harness>/INSTALL.md`: replace inline "ask scope + harness" guidance with pointers to the new canonical playbook command (see below).

### Added

- **`human-feedback help-agents`** — new subcommand printing the canonical install + usage playbook for AI coding agents. Single source of truth, version-locked to the installed CLI. Includes the explicit STOP gate (ask scope + harness before picking any defaults), install verification step, compile/share flow, and update-marker handling.
- **`build/bundle.js`** — esbuild-driven bundler that resolves `commander` and `picocolors` against the project's own `node_modules`, bypassing any ancestor Yarn PnP manifest (e.g. a stray `~/.pnp.cjs`) that would otherwise break module resolution.
- **`build:bundle`, `build:all`** npm scripts. `test` and `prepack` now run `build:all`. New `test/help-agents.js` smoke test (15 assertions) wired into the test suite.
- **Backfilled CHANGELOG entries for 0.2.5, 0.2.6, 0.2.7** so the GitHub release workflow's awk-extractor stops falling back to the generic "See CHANGELOG.md for details" placeholder for those tags.

### Fixed

- Codex install flow: agents reading `plugins/codex/INSTALL.md` (or any other harness's INSTALL.md) now see a top banner pointing at `help-agents` before they pick a default scope/harness.

## [0.2.7] — 2026-05-27

### Changed

- README: extend the "for agents" install guidance to note that most harnesses require a new session or skill/command reload before `/human-feedback` is available.

## [0.2.6] — 2026-05-27

Re-tag of 0.2.5 to retrigger the release workflow. No code changes.

## [0.2.5] — 2026-05-27

### Added

- **README "Releasing" section** documenting the `v*` tag workflow that fires `.github/workflows/release.yml`, including how to cut a release, what the workflow does, and how to retag a published version.

### Changed

- **"For agents" install guidance** in the README + plugin INSTALL.md files: instruct agents to ask the user about install scope (global vs project-local) and which harnesses to wire up before running any `human-feedback install --<harness>` command. Stops agents from silently picking defaults.

## [0.2.4] — 2026-05-27

### Changed

- **Compiled artifacts now carry `Cache-Control: no-store` headers** plus `Pragma`/`Expires` fallbacks, injected into `<head>` of every output. A normal browser reload always shows the latest content — no hard-refresh, no filename juggling. This makes the `-r<N>` filename suffix convention unnecessary; recompile in place against the same `-o <output>` path on every iteration.

### Added

- **Real `<title>` derived from content.** Compiled HTML titles now reflect the source instead of the generic "MD Annotator" / "Human Feedback" template defaults:
  - Markdown → first `# H1`
  - HTML → source's existing `<title>`
  - JSON → `config.title`
  - Fallback → humanized filename stem (`RD-Strategy-H2-2026-v0-nadav` → "RD Strategy H2 2026 v0 nadav")
- **Build-stamp comment** at the top of every compiled artifact: `<!-- @human-feedback build-stamp: <ISO timestamp> | source: <filename> -->` — view-source sanity check for "is this the latest build?".
- `<meta name="human-feedback-built-at" content="<ISO>">` for programmatic freshness checks.
- **Automated GitHub Release workflow** — pushing a `v*` tag triggers `.github/workflows/release.yml`, which extracts the matching CHANGELOG section and publishes a Release. No more manual click in the GitHub UI.

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
