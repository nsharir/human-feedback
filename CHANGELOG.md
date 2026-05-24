# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added — review-artifact rule + opt-in `-review` suffix whitelist

- The injected system-prompt rule now covers **two** contracts in one block: the existing >1-question rule AND a new review-artifact rule. Agents are told that any file the user must review must be named `<topic>-review.md` / `<topic>-review.html` — the hook auto-compiles + auto-opens it, and the agent replies only `review opened ✓ — waiting on your response.` and stops.
- `shouldWrap` is now an explicit **whitelist**: only `*-review.md`, `*-review.html`, and `questions*.json` get wrapped. Everything else — `README.md`, `CHANGELOG.md`, `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, source code, arbitrary scratch markdown — passes through silently. This stops the hook from popping a browser every time the agent writes a routine `.md`.
- Defense-in-depth: a name-based skip list (`CHANGELOG|README|AGENTS|CLAUDE|SKILL|CONTRIBUTING|LICENSE|NOTICE|TODO|NOTES|HOOK|PLUGIN`) catches accidental misnames.
- Rule text rewritten for token efficiency — ~40% shorter while covering both rules and the opt-out env vars.

### Hook architecture

- The single shared post-write hook (`plugins/shared/post-write-hook.js`) remains the **only** hook in use. Every event (`SessionStart`, `UserPromptSubmit`, `beforeSubmitPrompt`, `PostToolUse`, `afterFileEdit`, Hermes `pre_llm_call`, Hermes `post_tool_call`) routes through one binary entry point (`agent-feedback __hook`). No second hook script, no harness-specific dispatchers.

## [1.5.0]

### Added — system-prompt rule injection across all harnesses
- **The >1-question rule now reaches the agent at session start, not just after it writes a file.** Each harness's hook config gains additional managed groups that route the agent's native context-injection events to the shared `agent-feedback __hook` binary:
  - **Claude Code:** `SessionStart` + `UserPromptSubmit` → `hookSpecificOutput.additionalContext`
  - **Codex:** `SessionStart` + `UserPromptSubmit` → `hookSpecificOutput.additionalContext`
  - **Cursor:** `beforeSubmitPrompt` → `agentMessage`
  - **Hermes:** new `pre_llm_call` hook in the Python plugin → ephemeral context on the first LLM call of each session (idempotent per session for prompt-cache safety; re-armed on `on_session_reset`)
- No project markdown files (`CLAUDE.md` / `AGENTS.md` / `.cursorrules` / `.cursor/rules/`) are touched — the rule is injected through each agent's runtime context channel only.
- New `lib/rule-injection.js` exports `RULE_TEXT` — single source of truth for the >1-question contract; the shared hook script reads from it.
- Added test coverage: `test/post-write-hook.js` now exercises all four rule-injection paths and the `AGENT_FEEDBACK_DISABLED=1` opt-out. `test/installer.js` verifies the new groups are written and removed cleanly.

### Fixed
- **Hermes plugin was never actually loading.** The previous `__init__.py` exported a `__plugin__` dict but Hermes' plugin loader calls a top-level `register(ctx)` function. The plugin now exposes `register(ctx)` that wires the three hooks (`post_tool_call`, `pre_llm_call`, `on_session_reset`); legacy callable aliases are kept for any out-of-tree importers.
- Added `plugin.yaml` alongside `plugin.json` for Hermes' YAML-based manifest loader.

## [1.4.0]

### Added
- **Auto-open wrapped files in the user's default browser** after the hook compiles them (`open` on macOS, `start` on Windows, `xdg-open` on Linux). Closes the last manual step in the feedback loop — agents no longer need to remember to share or open the file. Works across all four harnesses (Hermes / Claude Code / Cursor / Codex). Opt out with `AGENT_FEEDBACK_AUTO_OPEN=0`. Auto-skipped in CI (`CI=1`) and on headless Linux (no `$DISPLAY` / `$WAYLAND_DISPLAY`).
- Agent-facing hook message updated to instruct the agent to stop and wait for the user's response, rather than continuing with dependent tool calls.

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
