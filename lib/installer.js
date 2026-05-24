'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   Installer for human-feedback skill definitions.

   Detects which agent harnesses are present and installs a slash-command /
   skill / rule file into each one. Idempotent — re-running is safe.

   Supports: Claude Code, Cursor, Codex, Hermes
   Scopes:   project (cwd) and global ($HOME)
   ───────────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const TEMPLATE_DIR = path.join(__dirname, '..', 'plugins');

// ── Harness descriptors ─────────────────────────────────────────────────────
const HARNESSES = {
  'claude-code': {
    label: 'Claude Code',
    get projectTarget() { return path.join(process.cwd(), '.claude', 'commands', 'human-feedback.md'); },
    get globalTarget()  { return path.join(os.homedir(),  '.claude', 'commands', 'human-feedback.md'); },
    get projectMarker() { return path.join(process.cwd(), '.claude'); },
    get globalMarker()  { return path.join(os.homedir(),  '.claude'); },
    template: path.join(TEMPLATE_DIR, 'claude-code', 'human-feedback.command.md'),
    install:   installFile,
    uninstall: uninstallFile,
  },
  'cursor': {
    label: 'Cursor',
    get projectTarget() { return path.join(process.cwd(), '.cursor', 'rules', 'human-feedback.mdc'); },
    get globalTarget()  { return path.join(os.homedir(),  '.cursor', 'rules', 'human-feedback.mdc'); },
    get projectMarker() { return path.join(process.cwd(), '.cursor'); },
    get globalMarker()  { return path.join(os.homedir(),  '.cursor'); },
    template: path.join(TEMPLATE_DIR, 'cursor', 'human-feedback.rule.mdc'),
    install:   installFile,
    uninstall: uninstallFile,
  },
  'codex': {
    label: 'Codex',
    get projectTarget() { return path.join(process.cwd(), 'AGENTS.md'); },
    get globalTarget()  { return path.join(os.homedir(),  'AGENTS.md'); },
    get projectMarker() { return path.join(process.cwd(), '.codex'); },
    get globalMarker()  { return path.join(os.homedir(),  '.codex'); },
    template: path.join(TEMPLATE_DIR, 'codex', 'human-feedback.agents-section.md'),
    install:   installCodex,
    uninstall: uninstallCodex,
  },
  'hermes': {
    label: 'Hermes',
    get projectTarget() { return path.join(process.cwd(), '.hermes', 'skills', 'human-feedback', 'SKILL.md'); },
    get globalTarget()  { return path.join(os.homedir(),  '.hermes', 'skills', 'human-feedback', 'SKILL.md'); },
    get projectMarker() { return path.join(process.cwd(), '.hermes'); },
    get globalMarker()  { return path.join(os.homedir(),  '.hermes'); },
    template: path.join(TEMPLATE_DIR, 'hermes', 'human-feedback.skill.md'),
    install:   installFile,
    uninstall: uninstallHermes,
  },
};

// ── Detection ───────────────────────────────────────────────────────────────
function detectHarness(name, scope) {
  const h = HARNESSES[name];
  if (!h) return false;
  const marker = scope === 'global' ? h.globalMarker : h.projectMarker;
  return fs.existsSync(marker);
}

function detectAll() {
  const result = {};
  for (const key of Object.keys(HARNESSES)) {
    result[key] = {
      project: detectHarness(key, 'project'),
      global:  detectHarness(key, 'global'),
    };
  }
  return result;
}

// ── Version extraction ──────────────────────────────────────────────────────
const VERSION_RE = /<!-- human-feedback v([\d.]+)/;

function versionFromContent(content) {
  const m = content.match(VERSION_RE);
  return m ? m[1] : null;
}

// ── Generic file-based install (Claude Code, Cursor, Hermes) ────────────────
function installFile(scope, harness) {
  const h = HARNESSES[harness];
  const target = scope === 'global' ? h.globalTarget : h.projectTarget;

  const templateContent = fs.readFileSync(h.template, 'utf8');

  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, 'utf8');
    if (existing === templateContent) {
      return { changed: false, target, note: 'already up to date' };
    }
    const existingVer  = versionFromContent(existing);
    const templateVer  = versionFromContent(templateContent);
    if (existingVer && templateVer && existingVer === templateVer) {
      return { changed: false, target, note: 'same version' };
    }
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, templateContent, 'utf8');

  return { changed: true, target };
}

// ── Generic file-based uninstall ────────────────────────────────────────────
function uninstallFile(scope, harness) {
  const h = HARNESSES[harness];
  const target = scope === 'global' ? h.globalTarget : h.projectTarget;

  if (!fs.existsSync(target)) {
    return { changed: false, target };
  }

  fs.unlinkSync(target);
  return { changed: true, target };
}

// ── Hermes uninstall: remove the skill directory ────────────────────────────
function uninstallHermes(scope) {
  const h = HARNESSES['hermes'];
  const target = scope === 'global' ? h.globalTarget : h.projectTarget;
  const skillDir = path.dirname(target);

  if (!fs.existsSync(skillDir)) {
    return { changed: false, target };
  }

  fs.rmSync(skillDir, { recursive: true, force: true });
  return { changed: true, target };
}

// ── Codex install: append marked section to AGENTS.md ───────────────────────
const CODEX_BEGIN = '<!-- human-feedback:begin';
const CODEX_END   = '<!-- human-feedback:end -->';

function installCodex(scope) {
  const h = HARNESSES['codex'];
  const target = scope === 'global' ? h.globalTarget : h.projectTarget;
  const templateContent = fs.readFileSync(h.template, 'utf8');
  const templateVer = versionFromContent(templateContent);

  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, 'utf8');

    if (existing.includes(CODEX_BEGIN)) {
      // Extract existing block
      const blockRe = new RegExp(
        CODEX_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '[\\s\\S]*?' +
        CODEX_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      );
      const currentBlock = (existing.match(blockRe) || [])[0];

      if (currentBlock === templateContent.trim()) {
        return { changed: false, target, note: 'already up to date' };
      }

      const existingVer = versionFromContent(currentBlock || '');
      if (existingVer && templateVer && existingVer === templateVer) {
        return { changed: false, target, note: 'same version' };
      }

      // Replace in place
      const updated = existing.replace(blockRe, templateContent.trim());
      fs.writeFileSync(target, updated, 'utf8');
      return { changed: true, target };
    }

    // No existing block — append
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(target, existing + separator + templateContent.trim() + '\n', 'utf8');
    return { changed: true, target };
  }

  // No AGENTS.md — create with just our section
  fs.writeFileSync(target, templateContent.trim() + '\n', 'utf8');
  return { changed: true, target };
}

function uninstallCodex(scope) {
  const h = HARNESSES['codex'];
  const target = scope === 'global' ? h.globalTarget : h.projectTarget;

  if (!fs.existsSync(target)) {
    return { changed: false, target };
  }

  const existing = fs.readFileSync(target, 'utf8');
  if (!existing.includes(CODEX_BEGIN)) {
    return { changed: false, target };
  }

  const blockRe = new RegExp(
    '\\n?' +
    CODEX_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '[\\s\\S]*?' +
    CODEX_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '\\n?',
    'g',
  );
  let updated = existing.replace(blockRe, '');

  if (updated.trim() === '') {
    fs.unlinkSync(target);
  } else {
    fs.writeFileSync(target, updated, 'utf8');
  }
  return { changed: true, target };
}

// ── Doctor: check if skill is installed ─────────────────────────────────────
function isInstalled(harness, scope) {
  const h = HARNESSES[harness];
  if (!h) return false;
  const target = scope === 'global' ? h.globalTarget : h.projectTarget;

  if (harness === 'codex') {
    if (!fs.existsSync(target)) return false;
    const content = fs.readFileSync(target, 'utf8');
    return content.includes(CODEX_BEGIN);
  }

  return fs.existsSync(target);
}

// ── Public API ──────────────────────────────────────────────────────────────
function install(harness, scope) {
  const h = HARNESSES[harness];
  if (!h) throw new Error(`Unknown harness: ${harness}`);
  return h.install(scope || 'project', harness);
}

function uninstall(harness, scope) {
  const h = HARNESSES[harness];
  if (!h) throw new Error(`Unknown harness: ${harness}`);
  return h.uninstall(scope || 'project', harness);
}

module.exports = {
  HARNESSES,
  detectAll,
  detectHarness,
  install,
  uninstall,
  isInstalled,
};
