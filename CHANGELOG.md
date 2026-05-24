# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed (BREAKING)
- **Output format unified to a single free-text prompt across all three tools.** The feedback questioner previously copied a JSON payload (`{"_type": "agent_feedback_response", …}`); it now copies the same structured natural-language prompt used by the annotator and md-annotator. Agents that parsed the old JSON shape must switch to reading the prompt text. See README → *Output prompt* for the new format.
- Removed the **Copy JSON** button from the shared annotation panel — Copy Prompt is now the only output.

### Added
- `src/shared/build-prompt.js` — single `buildAgentPrompt({ tool, source, items })` helper consumed by all three tools so the output shape is identical by construction.
- `scripts/record-demo.js` + `examples/demos/md-annotator.gif` — scripted Playwright + ffmpeg demo recorder (reusable for html-annotator and feedback). Recording requires Playwright (any 1.5x+) and ffmpeg available on `PATH`; neither is an npm dependency of this repo. Run with `NODE_PATH=/path/to/playwright/node_modules node scripts/record-demo.js md-annotator`.

### Fixed
- Light-mode the md-annotator comment popover (was dark on dark).
- Shrink md-annotator preview body and headings by ~15–20% for better page density.

## [1.3.0] — 2026-05-24

### Added
- **Native harness plugins** — `agent-feedback install` patches hook configs for Claude Code, Cursor (1.7+), Codex CLI, and Hermes Agent (0.9+).
- **Single shared hook script** (`plugins/shared/post-write-hook.js`) handles event normalization across all four harnesses.
- New CLI commands: `install`, `uninstall`, `doctor`, and the hidden `__hook` subcommand invoked by hook configs.
- New env vars: `AGENT_FEEDBACK_DISABLED=1` to bypass the hook, `AGENT_FEEDBACK_VERBOSE=0` for quieter agent messages.
- Per-harness `INSTALL.md` guides under `plugins/<harness>/`.
- Installer tests covering detection, install, idempotency, user-config preservation, and uninstall.
- Examples folder with `.html`, `.md`, and `.json` inputs + `npm run compile:examples` script.

### Changed
- Package renamed to `@nsharir/agent-feedback` (repo: `nsharir/agent-feedback`).
- Repo restructured: `plugins/` directory added alongside `src/`, `lib/`, `bin/`.

## [1.2.0] — 2026-05-24

### Added
- **Build system** — sources now live in `src/` and reference shared modules via `@include` directives. Run `npm run build` to regenerate `lib/templates/`.
- Shared modules under `src/shared/` (design tokens, clipboard, preview dialog, toast) — single source of truth across all three tools.
- `npm test` runs the build first to verify everything compiles.

### Changed
- Repo restructured for maintainability. Built templates are still committed so end users can install without a build step.

## [1.1.1] — 2026-05-24

### Fixed
- 3-tier clipboard fallback. When both `navigator.clipboard` and `execCommand('copy')` fail (e.g. `file://` contexts), the preview textarea is auto-selected and a hint shows the platform-specific keyboard shortcut.

## [1.1.0] — 2026-05-24

### Added
- **Preview & Edit dialog** for all three tools. Users can edit the generated prompt/payload before copying.
- Unified light theme across all three tools.

### Fixed
- Checkboxes now toggle correctly (previously toggled twice due to label/input event bubbling).
- Clipboard copy now reliably reports success/failure.

## [1.0.0] — 2026-05-23

Initial release. Three tools:
- HTML annotator (`.html` → annotation-enabled HTML)
- Markdown annotator (`.md` → rendered review page)
- Agent feedback (`.json` → structured question form)
