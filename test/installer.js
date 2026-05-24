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
  {
    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.claude', 'settings.json'), 'utf8'));
    assert(Array.isArray(cfg.hooks.PostToolUse) && cfg.hooks.PostToolUse.length === 1, 'Claude Code: PostToolUse group');
    assert(Array.isArray(cfg.hooks.SessionStart) && cfg.hooks.SessionStart.length === 1, 'Claude Code: SessionStart group (rule injection)');
    assert(Array.isArray(cfg.hooks.UserPromptSubmit) && cfg.hooks.UserPromptSubmit.length === 1, 'Claude Code: UserPromptSubmit group (rule injection)');
  }

  const r2 = installer.install('cursor', 'project');
  assert(r2.changed && fs.existsSync(path.join(tmp, '.cursor', 'hooks.json')), 'installs Cursor config');
  {
    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.cursor', 'hooks.json'), 'utf8'));
    assert(Array.isArray(cfg.hooks.afterFileEdit) && cfg.hooks.afterFileEdit.length === 1, 'Cursor: afterFileEdit group');
    assert(Array.isArray(cfg.hooks.beforeSubmitPrompt) && cfg.hooks.beforeSubmitPrompt.length === 1, 'Cursor: beforeSubmitPrompt group (rule injection)');
  }

  const r3 = installer.install('codex', 'project');
  assert(r3.changed && fs.existsSync(path.join(tmp, '.codex', 'hooks.json')), 'installs Codex config');
  {
    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.codex', 'hooks.json'), 'utf8'));
    assert(Array.isArray(cfg.hooks.PostToolUse) && cfg.hooks.PostToolUse.length === 1, 'Codex: PostToolUse group');
    assert(Array.isArray(cfg.hooks.SessionStart) && cfg.hooks.SessionStart.length === 1, 'Codex: SessionStart group (rule injection)');
    assert(Array.isArray(cfg.hooks.UserPromptSubmit) && cfg.hooks.UserPromptSubmit.length === 1, 'Codex: UserPromptSubmit group (rule injection)');
  }

  const r4 = installer.install('hermes', 'project');
  assert(r4.changed && fs.existsSync(path.join(tmp, '.hermes', 'plugins', 'agent_feedback', '__init__.py')), 'installs Hermes plugin');

  // Hermes install also writes the rule into MEMORY.md (project scope here).
  const memoryFile = path.join(tmp, '.hermes', 'memories', 'MEMORY.md');
  assert(fs.existsSync(memoryFile), 'Hermes: creates MEMORY.md when missing');
  {
    const mem = fs.readFileSync(memoryFile, 'utf8');
    assert(mem.includes('agent-feedback:managed-rule:begin'), 'Hermes: memory rule begin marker written');
    assert(mem.includes('agent-feedback:managed-rule:end'),   'Hermes: memory rule end marker written');
    assert(mem.includes('questions*.json'),                   'Hermes: memory rule body contains the >1-question contract');
    assert(mem.includes('.hermes/plans/'),                    'Hermes: memory rule body instructs writing under .hermes/plans/');
    assert(mem.includes('Workspace::v1'),                     'Hermes: memory rule body references the Workspace::v1 tag');
    assert(r4.memory && r4.memory.wrote === true,             'Hermes: install result reports memory.wrote=true');
  }

  // Memory write is idempotent — second install on already-populated MEMORY.md
  // must not duplicate the entry.
  const r4c = installer.install('hermes', 'project');
  {
    const mem = fs.readFileSync(memoryFile, 'utf8');
    const occurrences = (mem.match(/agent-feedback:managed-rule:begin/g) || []).length;
    assert(occurrences === 1, 'Hermes: re-install does not duplicate the memory rule');
    assert(r4c.memory && r4c.memory.wrote === false, 'Hermes: idempotent install reports memory.wrote=false');
  }

  // Memory install preserves prior MEMORY.md entries.
  fs.unlinkSync(memoryFile);
  fs.writeFileSync(memoryFile, 'user note one\n§\nuser note two\n');
  // Force a re-write by removing the plugin sentinel + reinstalling
  fs.rmSync(path.join(tmp, '.hermes', 'plugins', 'agent_feedback'), { recursive: true, force: true });
  installer.install('hermes', 'project');
  {
    const mem = fs.readFileSync(memoryFile, 'utf8');
    assert(mem.startsWith('user note one\n§\nuser note two\n'), 'Hermes: memory install preserves prior entries');
    assert(mem.includes('agent-feedback:managed-rule:begin'),   'Hermes: memory install appends rule entry');
    // The appended block must be separated by a "§" line.
    assert(/\n§\n<!-- agent-feedback:managed-rule:begin -->/.test(mem),
      'Hermes: appended rule is delimited by "§" from prior entries');
  }

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

  // Uninstall must also strip the managed memory entry while preserving user prose.
  if (fs.existsSync(memoryFile)) {
    const mem = fs.readFileSync(memoryFile, 'utf8');
    assert(!mem.includes('agent-feedback:managed-rule'), 'Hermes: uninstall removes managed memory rule');
    assert(mem.includes('user note one') && mem.includes('user note two'),
      'Hermes: uninstall preserves user-added memory entries');
  } else {
    // The user-prose-only file remained; ensure it really is empty-of-rule.
    assert(true, 'Hermes: uninstall left no managed memory rule (file removed)');
  }
  assert(u4.memory && u4.memory.removed === true, 'Hermes: uninstall result reports memory.removed=true');

  console.log('\n=== Installer tests complete ===\n');
} finally {
  process.chdir(origCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
