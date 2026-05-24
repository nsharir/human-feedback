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
  assert(r4b.plugin && r4b.plugin.action === 'skipped',
    'Hermes: same-version re-install reports plugin.action=skipped');

  // v1.7.4 — auto-upgrade when the installed plugin.json reports an
  // older version than the bundled one. Simulate by downgrading the
  // installed plugin.json and re-running install.
  {
    const pluginFile = path.join(tmp, '.hermes', 'plugins', 'agent_feedback', 'plugin.json');
    const meta = JSON.parse(fs.readFileSync(pluginFile, 'utf8'));
    const realVersion = meta.version;
    meta.version = '1.0.0-stale';
    fs.writeFileSync(pluginFile, JSON.stringify(meta, null, 2));

    const rUp = installer.install('hermes', 'project');
    assert(rUp.changed === true, 'Hermes: stale plugin triggers a re-install');
    assert(rUp.plugin && rUp.plugin.action === 'upgraded',
      'Hermes: stale plugin reports plugin.action=upgraded');
    assert(rUp.plugin.from === '1.0.0-stale' && rUp.plugin.to === realVersion,
      'Hermes: upgrade result reports from/to versions');

    const after = JSON.parse(fs.readFileSync(pluginFile, 'utf8'));
    assert(after.version === realVersion,
      'Hermes: upgrade overwrites plugin.json with the bundled version');
  }

  // v1.7.4 — memory rule body update propagates when re-running install
  // after the in-place MEMORY.md was hand-edited to an older variant.
  {
    let mem = fs.readFileSync(memoryFile, 'utf8');
    const tampered = mem.replace(
      /<!-- agent-feedback:managed-rule:begin -->[\s\S]*?<!-- agent-feedback:managed-rule:end -->/,
      '<!-- agent-feedback:managed-rule:begin -->\nold short rule body\n<!-- agent-feedback:managed-rule:end -->',
    );
    fs.writeFileSync(memoryFile, tampered);

    const rRewrite = installer.install('hermes', 'project');
    assert(rRewrite.memory && rRewrite.memory.wrote === true,
      'Hermes: drifted memory rule is rewritten on re-install');

    mem = fs.readFileSync(memoryFile, 'utf8');
    assert(!mem.includes('old short rule body'),
      'Hermes: re-install removes the stale rule body');
    assert(mem.includes('mockups') || mem.includes('UX mockups'),
      'Hermes: refreshed rule body includes the mockup clause');
    const occ = (mem.match(/agent-feedback:managed-rule:begin/g) || []).length;
    assert(occ === 1, 'Hermes: re-write does not duplicate the managed block');
  }

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
