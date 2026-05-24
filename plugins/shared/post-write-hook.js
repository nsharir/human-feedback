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
function shouldWrap(filePath) {
  if (!filePath) return false;
  // Skip if the user opted out
  if (process.env.AGENT_FEEDBACK_DISABLED === '1') return false;
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.md' && ext !== '.markdown' && ext !== '.html' && ext !== '.htm' && ext !== '.json') return false;
  // Skip already-compiled files (avoid wrap loops)
  if (/\.(review|feedback|annotated)\.html?$/i.test(filePath)) return false;
  // Skip files in node_modules / dist / build / .git
  if (/[\/\\](node_modules|dist|build|coverage|\.git)[\/\\]/.test(filePath)) return false;
  // Skip package.json, tsconfig.json, and other config-y JSON
  const base = path.basename(filePath).toLowerCase();
  if (ext === '.json' && /^(package|package-lock|tsconfig|jsconfig|composer|cargo|pyproject|.eslintrc|.prettierrc)/.test(base)) return false;
  // Only wrap files that actually exist on disk (the hook runs AFTER the write,
  // so the file should be present)
  if (!fs.existsSync(filePath)) return false;
  return true;
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

// ── Auto-open the wrapped file in the user's default browser ──────────────
// This closes the last manual step in the feedback loop: the agent no longer
// has to remember to share or open the file — the user sees it pop up as soon
// as the agent writes the source. Opt out with AGENT_FEEDBACK_AUTO_OPEN=0.
//
// For .json (feedback forms) auto-open is especially important: the form IS
// the agent's question to the user. We default to opening for ALL wrapped
// types so behavior is consistent across harnesses (Hermes / Claude Code /
// Cursor / Codex) and operating systems.
function openInBrowser(filePath) {
  if (process.env.AGENT_FEEDBACK_AUTO_OPEN === '0') return { opened: false, reason: 'disabled' };
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

const openedLine = openResult.opened
  ? `It has already been opened in the user's default browser — do NOT instruct them to open it manually.`
  : `Auto-open was skipped (${openResult.reason || 'unknown'}); ask the user to open ${rel(outputPath)} in a browser.`;

const quietMsg = openResult.opened
  ? `[agent-feedback] wrapped + opened ${rel(outputPath)}`
  : `[agent-feedback] wrapped ${rel(norm.filePath)} → ${rel(outputPath)} (not opened: ${openResult.reason || 'unknown'})`;

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
