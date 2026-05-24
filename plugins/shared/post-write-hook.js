#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   agent-feedback post-write hook

   Invoked by Claude Code (PostToolUse), Cursor (afterFileEdit), Codex (PostToolUse),
   and Hermes (post_tool_call) after the agent writes or edits a file.

   Reads a JSON event from stdin, normalizes the harness-specific shape into a
   common form, decides whether to wrap the written file with the feedback
   framework, and writes a response on stdout that nudges the agent.

   Exit code:  0  always (never block the agent — this hook is additive)
   Stdout:     harness-specific JSON acknowledgment (see each branch)
   ───────────────────────────────────────────────────────────────────────────── */

'use strict';

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { RULE_TEXT, HERMES_ADDENDUM } = require(path.join(__dirname, '..', '..', 'lib', 'rule-injection.js'));

// ── Read stdin (all harnesses send JSON via stdin) ──────────────────────────
let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch (e) {
  // No stdin — exit silently
  process.exit(0);
}

let event;
try {
  event = JSON.parse(raw || '{}');
} catch (e) {
  // Malformed JSON — silently allow agent to continue
  process.exit(0);
}

// ── Rule-injection branch ───────────────────────────────────────────────────
// When the harness fires SessionStart / UserPromptSubmit / beforeSubmitPrompt,
// we don't have a file to wrap — we just want to push the >1-question rule
// into the agent's context. Recognize those events early and respond before
// the file-wrap normalize step runs.
//
// Each harness's hook config (installed by `agent-feedback install`) routes
// these events to the same `agent-feedback __hook` binary, so we branch here.

if (process.env.AGENT_FEEDBACK_DISABLED !== '1') {
  const evName = event.hook_event_name || '';
  // Claude Code & Codex: SessionStart, UserPromptSubmit
  if (evName === 'SessionStart' || evName === 'UserPromptSubmit') {
    // Harness is Claude-Code-shaped (both Claude Code and Codex use the same
    // additionalContext shape for these events).
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: evName,
        additionalContext: RULE_TEXT,
      },
    }));
    process.exit(0);
  }
  // Cursor: beforeSubmitPrompt (fires before each user prompt is submitted)
  if (evName === 'beforeSubmitPrompt') {
    process.stdout.write(JSON.stringify({ agentMessage: RULE_TEXT }));
    process.exit(0);
  }
  // Hermes pre_llm_call branch — the Python plugin posts {harness:'hermes',
  // event:'pre_llm_call'} when it wants the rule text returned. Hermes is
  // the only harness that gets the workspace-path addendum (others have no
  // [Workspace::v1: ...] convention).
  if (event.harness === 'hermes' && event.event === 'pre_llm_call') {
    process.stdout.write(JSON.stringify({ message: RULE_TEXT + HERMES_ADDENDUM }));
    process.exit(0);
  }
}

// ── Normalize the event across harnesses ────────────────────────────────────
// Each harness uses different field names. Normalize to:
//   { harness, toolName, filePath, isWrite }

function detectHarness(evt) {
  // Cursor: { hook_event_name: 'afterFileEdit'|'beforeShellExecution'|..., conversation_id, generation_id, workspace_roots, file_path? }
  // Check Cursor BEFORE Claude Code because Cursor's hook_event_name names are different
  if (evt.conversation_id !== undefined || evt.generation_id !== undefined || evt.workspace_roots !== undefined) {
    return 'cursor';
  }
  // Claude Code: { hook_event_name: 'PostToolUse'|..., tool_name, tool_input, session_id, transcript_path, cwd }
  if (evt.hook_event_name && evt.session_id !== undefined) {
    return 'claude-code';
  }
  // Codex: similar shape to Claude Code but no session_id (uses conversation_id elsewhere; differentiator is harness-specific)
  // For both Claude Code and Codex without distinguishing fields, fall back on event-name pattern
  if (evt.hook_event_name && evt.tool_name !== undefined) {
    // If it's a Claude-Code-style event name, prefer Claude Code; else Codex.
    // Both produce the same output format from our hook, so this only matters for routing.
    return 'claude-code';
  }
  // Hermes (Python plugin invokes us with): { harness: 'hermes', tool, file_path }
  if (evt.harness === 'hermes') return 'hermes';
  // Last-resort: a bare file_path with no other markers → assume Cursor
  if (evt.file_path !== undefined) return 'cursor';
  return 'unknown';
}

function normalize(evt) {
  const harness = detectHarness(evt);

  switch (harness) {
    case 'claude-code': {
      const toolName = evt.tool_name || '';
      const input    = evt.tool_input || {};
      const filePath = input.file_path || input.path || input.notebook_path || '';
      return {
        harness, toolName, filePath,
        isWrite: /^(Write|Edit|MultiEdit|NotebookEdit|Create|apply_patch|create_file|str_replace)$/i.test(toolName),
      };
    }
    case 'cursor': {
      // Cursor afterFileEdit passes file_path directly
      const filePath = evt.file_path || '';
      return { harness, toolName: 'FileEdit', filePath, isWrite: !!filePath };
    }
    case 'codex': {
      const toolName = evt.tool_name || '';
      const input    = evt.tool_input || evt.input || {};
      const filePath = input.file_path || input.path || '';
      return { harness, toolName, filePath, isWrite: /^(Write|Edit|apply_patch|create_file|str_replace)$/i.test(toolName) };
    }
    case 'hermes': {
      return { harness, toolName: evt.tool || '', filePath: evt.file_path || '', isWrite: !!evt.file_path };
    }
    default:
      return { harness: 'unknown', toolName: '', filePath: '', isWrite: false };
  }
}

const norm = normalize(event);

// ── Acknowledgment writers — each harness expects a different stdout shape ──
function ack(message, harness) {
  // The agent reads this as additional context after the tool call.
  switch (harness) {
    case 'claude-code':
      // Claude Code: hookSpecificOutput with additionalContext appended as a system reminder
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: message
        }
      }));
      break;
    case 'cursor':
      // Cursor afterFileEdit: { agentMessage } shows as a system message
      process.stdout.write(JSON.stringify({ agentMessage: message }));
      break;
    case 'codex':
      // Codex: hookSpecificOutput with additionalContext (matches Claude Code's shape)
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: message
        }
      }));
      break;
    case 'hermes':
      // Hermes plugin: just print message; the Python wrapper relays it
      process.stdout.write(JSON.stringify({ message }));
      break;
    default:
      // Unknown harness — emit plain text on stderr (gets logged), exit 0
      process.stderr.write(message + '\n');
  }
}

// ── Decide whether to wrap ─────────────────────────────────────────────────
// Wrap only files the agent has explicitly marked as "for human review":
//   • <topic>-review.md  /  <topic>-review.markdown
//   • <topic>-review.html / .htm
//   • questions*.json    (questionnaires)
// Everything else (CHANGELOG.md, README.md, source code, config json,
// scratch notes) is left alone. This stops the hook from popping a browser
// every time the agent writes a routine markdown file.
const REVIEW_SUFFIX_RE = /-review$/i;
const QUESTIONS_JSON_RE = /^questions[\w.-]*\.json$/i;
const INTERNAL_MD_STEM = /^(changelog|readme|agents|claude|skill|contributing|license|notice|todo|notes|hook|plugin)$/i;
const CONFIG_JSON_RE   = /^(package|package-lock|tsconfig|jsconfig|composer|cargo|pyproject|\.eslintrc|\.prettierrc|\.babelrc|\.stylelintrc)/i;

function shouldWrap(filePath) {
  if (!filePath) return false;
  if (process.env.AGENT_FEEDBACK_DISABLED === '1') return false;

  const ext  = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath);
  const stem = base.slice(0, base.length - ext.length);

  // Skip already-compiled outputs (avoid wrap loops)
  if (/\.(review|feedback|annotated)\.html?$/i.test(filePath)) return false;
  // Skip vendor / build / VCS noise
  if (/[\/\\](node_modules|dist|build|coverage|\.git)[\/\\]/.test(filePath)) return false;
  // Skip well-known internal markdown (defense in depth — they wouldn't
  // match the -review suffix anyway, but agents sometimes get creative)
  if ((ext === '.md' || ext === '.markdown') && INTERNAL_MD_STEM.test(stem)) return false;
  // Skip common config JSON
  if (ext === '.json' && CONFIG_JSON_RE.test(base)) return false;
  // Only wrap files that actually exist on disk
  if (!fs.existsSync(filePath)) return false;

  // Whitelist: -review suffix for md/html, or questions*.json for forms
  if (ext === '.md' || ext === '.markdown' || ext === '.html' || ext === '.htm') {
    return REVIEW_SUFFIX_RE.test(stem);
  }
  if (ext === '.json') {
    return QUESTIONS_JSON_RE.test(base);
  }
  return false;
}

// ── Quick-exit when we don't wrap ──────────────────────────────────────────
if (!norm.isWrite || !shouldWrap(norm.filePath)) {
  // Emit empty acknowledgment so the harness has something well-formed.
  ack('', norm.harness);
  process.exit(0);
}

// ── Determine output path ─────────────────────────────────────────────────
function deriveOutput(srcPath) {
  const dir   = path.dirname(srcPath);
  const ext   = path.extname(srcPath).toLowerCase();
  const stem  = path.basename(srcPath, path.extname(srcPath));
  const tool  = (ext === '.md' || ext === '.markdown') ? 'review'
              : (ext === '.html' || ext === '.htm')     ? 'annotated'
              : (ext === '.json')                       ? 'feedback'
              : 'review';
  return path.join(dir, `${stem}.${tool}.html`);
}

const outputPath = deriveOutput(norm.filePath);

// ── Resolve the CLI binary ────────────────────────────────────────────────
// The hook is invoked from within the @nsharir/agent-feedback install, so the
// 'agent-feedback' binary is on PATH. Fall back to invoking the
// local CLI directly.
function resolveToolkit() {
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';
  const w = spawnSync(whichCmd, ['agent-feedback'], { encoding: 'utf8' });
  if (w.status === 0 && w.stdout.trim()) {
    return ['agent-feedback', []];
  }
  // Fall back to invoking the local CLI relative to this file
  const local = path.resolve(__dirname, '..', '..', 'bin', 'cli.js');
  if (fs.existsSync(local)) {
    return ['node', [local]];
  }
  return null;
}

// ── Run the compile ───────────────────────────────────────────────────────
const resolved = resolveToolkit();
if (!resolved) {
  ack('[agent-feedback] agent-feedback CLI not found on PATH — skipped wrapping ' + norm.filePath, norm.harness);
  process.exit(0);
}

const [cmd, baseArgs] = resolved;
const args = baseArgs.concat(['compile', norm.filePath, '-o', outputPath, '--force']);

const result = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000 });

if (result.status !== 0) {
  // Quiet failure — emit a diagnostic but don't block the agent
  ack(`[agent-feedback] could not wrap ${norm.filePath}: ${(result.stderr || result.stdout || 'unknown error').trim().slice(0, 200)}`, norm.harness);
  process.exit(0);
}

// ── Auto-open is OPT-IN (changed in v1.7.0) ───────────────────────────────
// Previously auto-opened by default; users found the browser pop disruptive.
// Now the agent shares a file:// link in its reply and the user clicks to
// open it themselves. Re-enable auto-open with AGENT_FEEDBACK_AUTO_OPEN=1.
function openInBrowser(filePath) {
  if (process.env.AGENT_FEEDBACK_AUTO_OPEN !== '1') return { opened: false, reason: 'opt-in' };
  // CI / headless guard — skip when no display is available
  if (process.env.CI === 'true' || process.env.CI === '1') return { opened: false, reason: 'ci' };
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    return { opened: false, reason: 'headless' };
  }

  let cmd, args;
  if (process.platform === 'darwin') {
    cmd = 'open'; args = [filePath];
  } else if (process.platform === 'win32') {
    // `start` is a cmd.exe builtin; first quoted arg is the window title
    cmd = 'cmd'; args = ['/c', 'start', '""', filePath];
  } else {
    cmd = 'xdg-open'; args = [filePath];
  }

  try {
    // Detach so we don't block the hook on the browser launching
    const child = require('child_process').spawn(cmd, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return { opened: true };
  } catch (e) {
    return { opened: false, reason: e.message };
  }
}

const openResult = openInBrowser(outputPath);

// ── Build the agent message ────────────────────────────────────────────────
const rel = (p) => {
  try { return path.relative(process.cwd(), p) || p; } catch { return p; }
};

const ext  = path.extname(norm.filePath).toLowerCase();
const kind = (ext === '.json') ? 'feedback form'
           : (ext === '.html' || ext === '.htm') ? 'annotation wrapper'
           : 'review document';

const VERBOSE = process.env.AGENT_FEEDBACK_VERBOSE !== '0';

const fileUrl = 'file://' + outputPath;

// Hermes WebUI auto-renders `MEDIA:<path>` tokens inline. For .html outputs
// (which is what we always produce — questionnaires and review wrappers
// both end in .html / .feedback.html / .review.html / .annotated.html),
// emitting the MEDIA token in the agent's reply causes WebUI to embed the
// wrapped surface in a sandboxed iframe directly inside the chat bubble —
// no clickable link needed, no browser navigation, no `file://` security
// blocks. Other harnesses (Claude Code, Cursor, Codex) ignore the token
// because they're terminal-based and have no markdown renderer with this
// convention. We emit it in the agent-instruction so the model includes
// it verbatim in its reply.
const isHermes  = norm.harness === 'hermes';
const isHtmlOut = /\.html?$/i.test(outputPath);
const mediaToken = (isHermes && isHtmlOut) ? `MEDIA:${outputPath}` : null;

const openedLine = openResult.opened
  ? `It has already been opened in the user's default browser — do NOT instruct them to open it manually.`
  : (mediaToken
      ? `Include this token VERBATIM in your reply so the WebUI embeds the wrapped surface inline:\n  ${mediaToken}\nAlso share the file:// link as a fallback:\n  ${fileUrl}\nDo NOT auto-open it. Wait for the user's response.`
      : `Reply to the user with a clickable link to the wrapped file so they can open it:\n  ${fileUrl}\nDo NOT auto-open it. Wait for their response.`);

const quietMsg = openResult.opened
  ? `[agent-feedback] wrapped + opened ${rel(outputPath)}`
  : (mediaToken
      ? `[agent-feedback] wrapped ${rel(norm.filePath)} → include ${mediaToken} in reply (WebUI renders it inline); fallback link: ${fileUrl}`
      : `[agent-feedback] wrapped ${rel(norm.filePath)} → ${fileUrl} — share this link with the user`);

const verboseMsg = [
  `[agent-feedback] Wrapped ${rel(norm.filePath)} as a ${kind}: ${rel(outputPath)}`,
  ``,
  openedLine,
  ``,
  `When the user pastes their response back, the prompt will be a structured`,
  `free-text doc starting with "The user …" — each "## Item N" section has the`,
  `user's comment plus the context the agent needs to act on it.`,
  `Until then, stop and wait for the user's response — do not continue with`,
  `tool calls that depend on their answers.`,
].join('\n');

ack(VERBOSE ? verboseMsg : quietMsg, norm.harness);
process.exit(0);
