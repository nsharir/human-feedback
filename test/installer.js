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

  // ── Detection ─────────────────────────────────────────────────────────────
  const detected = installer.detectAll();
  assert(detected['claude-code'].project === true, 'detects Claude Code project scope');
  assert(detected['cursor'].project === true,      'detects Cursor project scope');
  assert(detected['codex'].project === true,       'detects Codex project scope');
  assert(detected['hermes'].project === true,      'detects Hermes project scope');

  // ── Claude Code install ───────────────────────────────────────────────────
  const r1 = installer.install('claude-code', 'project');
  const ccTarget = path.join(tmp, '.claude', 'commands', 'human-feedback.md');
  assert(r1.changed === true, 'Claude Code: install reports changed');
  assert(fs.existsSync(ccTarget), 'Claude Code: command file created');
  {
    const content = fs.readFileSync(ccTarget, 'utf8');
    assert(content.includes('human-feedback compile'), 'Claude Code: command file contains compile instruction');
    assert(content.includes('$ARGUMENTS'), 'Claude Code: command file references $ARGUMENTS');
    assert(content.includes('Claude Preview'), 'Claude Code: command file mentions Preview');
  }

  // Idempotency
  const r1b = installer.install('claude-code', 'project');
  assert(r1b.changed === false, 'Claude Code: install is idempotent');

  // ── Cursor install ────────────────────────────────────────────────────────
  const r2 = installer.install('cursor', 'project');
  const cursorTarget = path.join(tmp, '.cursor', 'rules', 'human-feedback.mdc');
  assert(r2.changed === true, 'Cursor: install reports changed');
  assert(fs.existsSync(cursorTarget), 'Cursor: rule file created');
  {
    const content = fs.readFileSync(cursorTarget, 'utf8');
    assert(content.includes('human-feedback compile'), 'Cursor: rule file contains compile instruction');
    assert(content.includes('alwaysApply: false'), 'Cursor: rule is agent-requested, not always-on');
  }

  // Idempotency
  const r2b = installer.install('cursor', 'project');
  assert(r2b.changed === false, 'Cursor: install is idempotent');

  // ── Codex install (AGENTS.md) ─────────────────────────────────────────────
  const r3 = installer.install('codex', 'project');
  const agentsMd = path.join(tmp, 'AGENTS.md');
  assert(r3.changed === true, 'Codex: install reports changed');
  assert(fs.existsSync(agentsMd), 'Codex: AGENTS.md created');
  {
    const content = fs.readFileSync(agentsMd, 'utf8');
    assert(content.includes('<!-- human-feedback:begin'), 'Codex: AGENTS.md has begin marker');
    assert(content.includes('<!-- human-feedback:end -->'), 'Codex: AGENTS.md has end marker');
    assert(content.includes('human-feedback compile'), 'Codex: AGENTS.md contains compile instruction');
  }

  // Idempotency
  const r3b = installer.install('codex', 'project');
  assert(r3b.changed === false, 'Codex: install is idempotent');

  // Preserves existing AGENTS.md content
  {
    fs.unlinkSync(agentsMd);
    fs.writeFileSync(agentsMd, '# My Project Agents\n\nSome user content here.\n');
    installer.install('codex', 'project');
    const content = fs.readFileSync(agentsMd, 'utf8');
    assert(content.startsWith('# My Project Agents'), 'Codex: preserves existing AGENTS.md content');
    assert(content.includes('<!-- human-feedback:begin'), 'Codex: appends section to existing file');
  }

  // ── Hermes install ────────────────────────────────────────────────────────
  const r4 = installer.install('hermes', 'project');
  const hermesTarget = path.join(tmp, '.hermes', 'skills', 'human-feedback', 'SKILL.md');
  assert(r4.changed === true, 'Hermes: install reports changed');
  assert(fs.existsSync(hermesTarget), 'Hermes: skill file created');
  {
    const content = fs.readFileSync(hermesTarget, 'utf8');
    assert(content.includes('human-feedback compile'), 'Hermes: skill file contains compile instruction');
    assert(content.includes('MEDIA:'), 'Hermes: skill file mentions MEDIA token');
    assert(content.includes('Workspace::v1'), 'Hermes: skill file references Workspace tag');
  }

  // Idempotency
  const r4b = installer.install('hermes', 'project');
  assert(r4b.changed === false, 'Hermes: install is idempotent');

  // ── isInstalled ───────────────────────────────────────────────────────────
  assert(installer.isInstalled('claude-code', 'project') === true, 'isInstalled: Claude Code = true');
  assert(installer.isInstalled('cursor', 'project') === true, 'isInstalled: Cursor = true');
  assert(installer.isInstalled('codex', 'project') === true, 'isInstalled: Codex = true');
  assert(installer.isInstalled('hermes', 'project') === true, 'isInstalled: Hermes = true');

  // ── Uninstall Claude Code ─────────────────────────────────────────────────
  const u1 = installer.uninstall('claude-code', 'project');
  assert(u1.changed === true, 'Claude Code: uninstall reports changed');
  assert(!fs.existsSync(ccTarget), 'Claude Code: command file removed');
  assert(installer.isInstalled('claude-code', 'project') === false, 'Claude Code: isInstalled = false after uninstall');

  // Uninstall when already removed
  const u1b = installer.uninstall('claude-code', 'project');
  assert(u1b.changed === false, 'Claude Code: uninstall is idempotent');

  // ── Uninstall Cursor ──────────────────────────────────────────────────────
  const u2 = installer.uninstall('cursor', 'project');
  assert(u2.changed === true, 'Cursor: uninstall reports changed');
  assert(!fs.existsSync(cursorTarget), 'Cursor: rule file removed');

  // ── Uninstall Codex ───────────────────────────────────────────────────────
  const u3 = installer.uninstall('codex', 'project');
  assert(u3.changed === true, 'Codex: uninstall reports changed');
  {
    const content = fs.readFileSync(agentsMd, 'utf8');
    assert(!content.includes('<!-- human-feedback:begin'), 'Codex: section removed from AGENTS.md');
    assert(content.includes('My Project Agents'), 'Codex: user content preserved after uninstall');
  }

  // ── Uninstall Hermes ──────────────────────────────────────────────────────
  const u4 = installer.uninstall('hermes', 'project');
  assert(u4.changed === true, 'Hermes: uninstall reports changed');
  assert(!fs.existsSync(path.join(tmp, '.hermes', 'skills', 'human-feedback')), 'Hermes: skill directory removed');

  // ── Legacy hook migration ─────────────────────────────────────────────────
  // Simulate a v1.x hook-based install and verify the new installer cleans it up
  {
    const settingsPath = path.join(tmp, '.claude', 'settings.json');
    const legacyCfg = {
      userCustom: { preserved: true },
      hooks: {
        PostToolUse: [{ __agent_feedback_managed__: true, hooks: [{ type: 'command', command: 'agent-feedback __hook' }] }],
        SessionStart: [{ __agent_feedback_managed__: true, hooks: [{ type: 'command', command: 'agent-feedback __hook' }] }],
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }],
      },
    };
    fs.writeFileSync(settingsPath, JSON.stringify(legacyCfg, null, 2));

    assert(installer.hasLegacyHooks('claude-code', 'project') === true, 'Legacy: detects old hooks');

    // Installing the new skill should also clean up legacy hooks
    installer.install('claude-code', 'project');
    const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert(after.userCustom?.preserved === true, 'Legacy: user config preserved');
    assert(after.hooks?.PreToolUse?.length === 1, 'Legacy: user hooks preserved');
    assert(!after.hooks?.PostToolUse, 'Legacy: managed PostToolUse removed');
    assert(!after.hooks?.SessionStart, 'Legacy: managed SessionStart removed');
    assert(installer.hasLegacyHooks('claude-code', 'project') === false, 'Legacy: no more legacy hooks');
    assert(fs.existsSync(ccTarget), 'Legacy: new skill file installed alongside cleanup');
  }

  // Legacy Hermes cleanup: old Python plugin + MEMORY.md
  {
    const pluginDir = path.join(tmp, '.hermes', 'plugins', 'agent_feedback');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, '.agent_feedback_managed'), '1\n');
    fs.writeFileSync(path.join(pluginDir, '__init__.py'), '# old plugin');

    const memDir = path.join(tmp, '.hermes', 'memories');
    fs.mkdirSync(memDir, { recursive: true });
    fs.writeFileSync(path.join(memDir, 'MEMORY.md'),
      'user note\n§\n<!-- agent-feedback:managed-rule:begin -->\nold rule\n<!-- agent-feedback:managed-rule:end -->\n');

    installer.install('hermes', 'project');
    assert(!fs.existsSync(pluginDir), 'Legacy Hermes: old plugin directory removed');
    {
      const mem = fs.readFileSync(path.join(memDir, 'MEMORY.md'), 'utf8');
      assert(!mem.includes('agent-feedback:managed-rule'), 'Legacy Hermes: managed memory rule removed');
      assert(mem.includes('user note'), 'Legacy Hermes: user memory entries preserved');
    }
  }

  console.log('\n=== Installer tests complete ===\n');
} finally {
  process.chdir(origCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}
