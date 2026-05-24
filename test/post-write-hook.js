'use strict';

/* Smoke tests for plugins/shared/post-write-hook.js
 *
 * Verifies:
 *  1. Hook compiles .json → .feedback.html
 *  2. AGENT_FEEDBACK_AUTO_OPEN=0 short-circuits the browser launch
 *     (we don't try to launch a real browser in CI — we just confirm
 *      the agent message reports "Auto-open was skipped (disabled)")
 *  3. CI=1 also skips auto-open
 *  4. AGENT_FEEDBACK_DISABLED=1 skips the whole wrap
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
  assert(fs.existsSync(path.join(dir, 'questions.feedback.html')), 'compiles .json → .feedback.html');
  assert(r.parsed && /Auto-open was skipped \(ci\)/.test(r.parsed.message || ''),
    'CI=1 reports auto-open skipped with reason=ci');
}

// ── 2. AGENT_FEEDBACK_AUTO_OPEN=0 reports reason=disabled ─────────────────
{
  const dir = tmpDir();
  const src = path.join(dir, 'notes.md');
  fs.writeFileSync(src, '# hi\n\nbody\n');

  // Unset CI so the disabled branch is exercised independently
  const r = runHook(src, { AGENT_FEEDBACK_AUTO_OPEN: '0', CI: '' });
  assert(r.status === 0, 'hook exits 0 for valid .md');
  assert(fs.existsSync(path.join(dir, 'notes.review.html')), 'compiles .md → .review.html');
  assert(r.parsed && /Auto-open was skipped \(disabled\)/.test(r.parsed.message || ''),
    'AGENT_FEEDBACK_AUTO_OPEN=0 reports auto-open skipped with reason=disabled');
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

console.log('\n=== Post-write hook tests complete ===\n');
