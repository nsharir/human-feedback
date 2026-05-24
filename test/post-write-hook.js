'use strict';

/* Smoke tests for plugins/shared/post-write-hook.js
 *
 * Verifies:
 *  1. Hook compiles .json → .feedback.html
 *  2. Default behavior (v1.7+): auto-open is OFF by default; agent message
 *     contains a file:// link instead of auto-launching a browser.
 *  3. AGENT_FEEDBACK_DISABLED=1 skips the whole wrap
 */

const fs            = require('fs');
const os            = require('os');
const path          = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'plugins', 'shared', 'post-write-hook.js');

function assert(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.error('  ✗', msg); process.exitCode = 1; }
}

function runHook(filePath, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  // Force CI=1 by default so tests never pop a real browser
  if (!('CI' in extraEnv)) env.CI = '1';
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ harness: 'hermes', tool: 'write_file', file_path: filePath }),
    encoding: 'utf8',
    timeout: 20000,
    env,
  });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout || '{}'); } catch {}
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, parsed };
}

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'agentfb-hook-')); }

console.log('\n=== Post-write hook tests ===\n');

// ── 1. JSON wrap + CI skip auto-open ──────────────────────────────────────
{
  const dir = tmpDir();
  const src = path.join(dir, 'questions.json');
  fs.writeFileSync(src, JSON.stringify({
    title: 'Test',
    questions: [{ id: 'q1', text: 'hi?', type: 'text' }],
  }));

  const r = runHook(src);
  assert(r.status === 0, 'hook exits 0 for valid .json');
  assert(fs.existsSync(path.join(dir, 'questions.feedback.html')), 'compiles questions.json → .feedback.html');
  assert(r.parsed && /file:\/\//.test(r.parsed.message || ''),
    'agent message contains a file:// link to the wrapped output');
}

// ── 2. Default: auto-open OFF; message includes the file:// link ──────────
{
  const dir = tmpDir();
  const src = path.join(dir, 'spec-review.md');
  fs.writeFileSync(src, '# hi\n\nbody\n');

  // Unset CI so the default opt-in branch is exercised independently
  const r = runHook(src, { CI: '' });
  assert(r.status === 0, 'hook exits 0 for valid -review.md');
  assert(fs.existsSync(path.join(dir, 'spec-review.review.html')), 'compiles -review.md → .review.html');
  assert(r.parsed && /file:\/\/.*spec-review\.review\.html/.test(r.parsed.message || ''),
    'default (no AUTO_OPEN=1) emits file:// link in agent message');
  assert(r.parsed && !/already been opened/.test(r.parsed.message || ''),
    'default does NOT claim the file was opened');
}

// ── 3. AGENT_FEEDBACK_DISABLED=1 skips the entire wrap ───────────────────
{
  const dir = tmpDir();
  const src = path.join(dir, 'questions.json');
  fs.writeFileSync(src, JSON.stringify({ title: 'T', questions: [] }));

  const r = runHook(src, { AGENT_FEEDBACK_DISABLED: '1' });
  assert(r.status === 0, 'hook exits 0 when disabled');
  assert(!fs.existsSync(path.join(dir, 'questions.feedback.html')),
    'AGENT_FEEDBACK_DISABLED=1 does not produce a wrapped file');
}

// ── 4. Already-wrapped output is not re-wrapped ──────────────────────────
{
  const dir = tmpDir();
  const src = path.join(dir, 'something.feedback.html');
  fs.writeFileSync(src, '<html></html>');

  const r = runHook(src);
  assert(r.status === 0, 'hook exits 0 on already-wrapped file');
  // Should not produce a .feedback.feedback.html or similar
  const sibs = fs.readdirSync(dir);
  assert(sibs.length === 1 && sibs[0] === 'something.feedback.html',
    'does not re-wrap an already-wrapped .feedback.html');
}

// ── 4b. Hermes harness: agent message embeds a MEDIA:<path> token ─────────
// WebUI auto-renders MEDIA:<path> as a sandboxed iframe for .html outputs,
// so the user sees the wrapped surface inline in the chat. The hook should
// instruct the agent to include the token verbatim in its reply.
{
  const dir = tmpDir();
  const src = path.join(dir, 'questions.json');
  fs.writeFileSync(src, JSON.stringify({
    title: 'Hermes MEDIA test',
    questions: [{ id: 'q1', text: 'hi?', type: 'text' }],
  }));

  const out = path.join(dir, 'questions.feedback.html');
  const r = runHook(src, { CI: '' });
  assert(r.status === 0, 'hermes hook exits 0');
  assert(r.parsed && r.parsed.message && r.parsed.message.includes('MEDIA:' + out),
    'hermes message embeds MEDIA:<output-path> token');
  assert(r.parsed && /file:\/\//.test(r.parsed.message),
    'hermes message still carries the file:// fallback link');
}

// ── 4c. Non-Hermes harness: MEDIA: token is NOT emitted ───────────────────
// Claude Code / Cursor / Codex are terminal-based and have no MEDIA: token
// convention. The hook must keep the file:// link path unchanged for them.
{
  const dir = tmpDir();
  const src = path.join(dir, 'questions.json');
  fs.writeFileSync(src, JSON.stringify({
    title: 'Non-hermes',
    questions: [{ id: 'q1', text: '?', type: 'text' }],
  }));

  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ harness: 'claude-code', tool: 'write_file', file_path: src }),
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, CI: '' },
  });
  let parsed = null; try { parsed = JSON.parse(r.stdout || '{}'); } catch {}
  // Claude Code's adapter writes to `agentMessage` rather than `message`,
  // but the underlying instruction we care about is the same — just check
  // whichever field carried the agent-facing payload.
  const msg = (parsed && (parsed.message || parsed.agentMessage)) || '';
  assert(r.status === 0, 'non-hermes hook exits 0');
  assert(msg && !msg.includes('MEDIA:'),
    'non-hermes message does NOT include a MEDIA: token');
  assert(/file:\/\//.test(msg),
    'non-hermes message still carries the file:// link');
}

// ── 4b. Whitelist enforcement: plain .md without -review is NOT wrapped ──
{
  const dir = tmpDir();
  const src = path.join(dir, 'notes.md');
  fs.writeFileSync(src, '# scratch\n');
  const r = runHook(src);
  assert(r.status === 0, 'plain .md (no -review suffix): exits 0');
  assert(!fs.existsSync(path.join(dir, 'notes.review.html')),
    'plain .md (no -review suffix) is NOT wrapped');
}

// ── 4c. Whitelist enforcement: README.md / CHANGELOG.md skipped ──────────
{
  for (const name of ['README.md', 'CHANGELOG.md', 'AGENTS.md', 'SKILL.md']) {
    const dir = tmpDir();
    const src = path.join(dir, name);
    fs.writeFileSync(src, '# x\n');
    const r = runHook(src);
    assert(r.status === 0, `${name}: exits 0`);
    const wrapped = path.join(dir, name.replace(/\.md$/, '.review.html'));
    assert(!fs.existsSync(wrapped), `${name} is NOT wrapped (internal MD skip)`);
  }
}

// ── 4d. Whitelist enforcement: -review.html IS wrapped ───────────────────
{
  const dir = tmpDir();
  const src = path.join(dir, 'mockup-review.html');
  fs.writeFileSync(src, '<!doctype html><html><body><h1>hi</h1></body></html>');
  const r = runHook(src);
  assert(r.status === 0, '-review.html: exits 0');
  assert(fs.existsSync(path.join(dir, 'mockup-review.annotated.html')),
    '-review.html → .annotated.html');
}

console.log('\n=== Post-write hook tests complete ===\n');

// ── 5. Rule-injection events ──────────────────────────────────────────────
// Verify the SessionStart / UserPromptSubmit / beforeSubmitPrompt / Hermes
// pre_llm_call paths emit the >1-question rule text in the correct shape
// for each harness.

console.log('\n=== Rule-injection event tests ===\n');

function runHookWithEvent(event, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  if (!('CI' in extraEnv)) env.CI = '1';
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify(event),
    encoding: 'utf8',
    timeout: 10000,
    env,
  });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout || '{}'); } catch {}
  return { status: r.status, parsed };
}

// Claude Code SessionStart
{
  const r = runHookWithEvent({ hook_event_name: 'SessionStart', session_id: 'abc' });
  assert(r.status === 0, 'SessionStart: exits 0');
  const ac = r.parsed?.hookSpecificOutput?.additionalContext || '';
  assert(/>1-question rule/.test(ac), 'SessionStart: emits rule text in additionalContext');
  assert(r.parsed?.hookSpecificOutput?.hookEventName === 'SessionStart',
    'SessionStart: echoes hookEventName');
}

// Claude Code UserPromptSubmit
{
  const r = runHookWithEvent({ hook_event_name: 'UserPromptSubmit', session_id: 'abc' });
  assert(r.status === 0, 'UserPromptSubmit: exits 0');
  const ac = r.parsed?.hookSpecificOutput?.additionalContext || '';
  assert(/questions\.json/.test(ac), 'UserPromptSubmit: rule mentions questions.json');
}

// Cursor beforeSubmitPrompt
{
  const r = runHookWithEvent({
    hook_event_name: 'beforeSubmitPrompt',
    conversation_id: 'c1',
    generation_id: 'g1',
  });
  assert(r.status === 0, 'beforeSubmitPrompt: exits 0');
  assert(/>1-question rule/.test(r.parsed?.agentMessage || ''),
    'beforeSubmitPrompt: rule text in agentMessage');
}

// Hermes pre_llm_call
{
  const r = runHookWithEvent({ harness: 'hermes', event: 'pre_llm_call' });
  assert(r.status === 0, 'Hermes pre_llm_call: exits 0');
  assert(/>1-question rule/.test(r.parsed?.message || ''),
    'Hermes pre_llm_call: rule text in message');
  // Workspace-path addendum is Hermes-only.
  assert(/Workspace::v1/.test(r.parsed?.message || ''),
    'Hermes pre_llm_call: includes Workspace::v1 addendum');
  assert(/\.hermes\/plans\//.test(r.parsed?.message || ''),
    'Hermes pre_llm_call: instructs writing into .hermes/plans/');
}

// ── Non-Hermes harnesses do NOT get the workspace addendum ────────────────
{
  const r = runHookWithEvent({ hook_event_name: 'SessionStart' });
  const ac = r.parsed?.hookSpecificOutput?.additionalContext || '';
  assert(!/Workspace::v1/.test(ac),
    'SessionStart (Claude Code): does NOT include Hermes Workspace::v1 addendum');
  assert(!/\.hermes\/plans\//.test(ac),
    'SessionStart (Claude Code): does NOT mention .hermes/plans/');
}

// Disabled — no rule injection
{
  const r = runHookWithEvent(
    { hook_event_name: 'SessionStart' },
    { AGENT_FEEDBACK_DISABLED: '1' },
  );
  assert(r.status === 0, 'SessionStart + DISABLED=1: exits 0');
  // When disabled at SessionStart, the hook falls through to the file-wrap
  // path; since there's no file_path, that path emits an empty ack. Confirm
  // we did NOT emit the rule text.
  const ac = r.parsed?.hookSpecificOutput?.additionalContext || r.parsed?.agentMessage || r.parsed?.message || '';
  assert(!/>1-question rule/.test(ac),
    'AGENT_FEEDBACK_DISABLED=1 suppresses rule injection');
}

console.log('\n=== Rule-injection event tests complete ===\n');
