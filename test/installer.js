'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const installer = require('../lib/installer');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agentfb-test-'));
}

function assert(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { console.error('  ✗', msg); process.exitCode = 1; }
}

console.log('\n=== Installer tests ===\n');

const tmp = tmpDir();
const origCwd = process.cwd();
process.chdir(tmp);

try {
  // Create harness markers
  ['claude', 'cursor', 'codex', 'hermes'].forEach(name => {
    fs.mkdirSync(path.join(tmp, `.${name}`), { recursive: true });
  });

  // Detection
  const detected = installer.detectAll();
  assert(detected['claude-code'].project === true, 'detects Claude Code project scope');
  assert(detected['cursor'].project === true,      'detects Cursor project scope');
  assert(detected['codex'].project === true,       'detects Codex project scope');
  assert(detected['hermes'].project === true,      'detects Hermes project scope');

  // Install each
  const r1 = installer.install('claude-code', 'project');
  assert(r1.changed && fs.existsSync(path.join(tmp, '.claude', 'settings.json')), 'installs Claude Code config');

  const r2 = installer.install('cursor', 'project');
  assert(r2.changed && fs.existsSync(path.join(tmp, '.cursor', 'hooks.json')), 'installs Cursor config');

  const r3 = installer.install('codex', 'project');
  assert(r3.changed && fs.existsSync(path.join(tmp, '.codex', 'hooks.json')), 'installs Codex config');

  const r4 = installer.install('hermes', 'project');
  assert(r4.changed && fs.existsSync(path.join(tmp, '.hermes', 'plugins', 'agent_feedback', '__init__.py')), 'installs Hermes plugin');

  // Idempotency
  const r1b = installer.install('claude-code', 'project');
  assert(r1b.changed === false, 'Claude Code install is idempotent');
  const r4b = installer.install('hermes', 'project');
  assert(r4b.changed === false, 'Hermes install is idempotent');

  // Preserves existing config
  const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.claude', 'settings.json'), 'utf8'));
  cfg.userCustom = { foo: 'bar' };
  cfg.hooks.PreToolUse = [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }];
  fs.writeFileSync(path.join(tmp, '.claude', 'settings.json'), JSON.stringify(cfg, null, 2));

  // Uninstall should preserve user content
  const u1 = installer.uninstall('claude-code', 'project');
  assert(u1.changed === true, 'uninstalls Claude Code hook');

  const afterUninstall = JSON.parse(fs.readFileSync(path.join(tmp, '.claude', 'settings.json'), 'utf8'));
  assert(afterUninstall.userCustom?.foo === 'bar', 'preserves user-added fields');
  assert(afterUninstall.hooks?.PreToolUse?.length === 1, 'preserves user-added hooks');
  assert(!afterUninstall.hooks?.PostToolUse, 'removed only the managed PostToolUse hook');

  // Uninstall Hermes
  const u4 = installer.uninstall('hermes', 'project');
  assert(u4.changed === true && !fs.existsSync(path.join(tmp, '.hermes', 'plugins', 'agent_feedback')), 'uninstalls Hermes plugin');

  console.log('\n=== Installer tests complete ===\n');
} finally {
  process.chdir(origCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
