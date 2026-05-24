'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   Installer for agent-feedback plugins.

   Detects which agent harnesses are present and offers to install the
   post-write hook into each one's config. Idempotent — re-running is safe.

   Supports: Claude Code, Cursor, Codex, Hermes
   Scopes:   project (cwd) and global ($HOME)
   ───────────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const TEMPLATE_DIR = path.join(__dirname, '..', 'plugins');
const HERMES_SRC   = path.join(TEMPLATE_DIR, 'hermes', 'agent_feedback');

// Marker so the installer can find hooks it installed and remove them.
const INSTALL_MARKER = '__agent_feedback_managed__';

// ── Harness descriptors ─────────────────────────────────────────────────────
// Paths resolved lazily (via getters) so installer respects the current cwd
// at call time, not at require time.
const HARNESSES = {
  'claude-code': {
    label: 'Claude Code',
    get projectConfig() { return path.join(process.cwd(), '.claude', 'settings.json'); },
    get globalConfig()  { return path.join(os.homedir(),  '.claude', 'settings.json'); },
    get projectMarker() { return path.join(process.cwd(), '.claude'); },
    get globalMarker()  { return path.join(os.homedir(),  '.claude'); },
    template:      path.join(TEMPLATE_DIR, 'claude-code', 'settings.template.json'),
    install:       installClaudeCode,
    uninstall:     uninstallClaudeCode,
  },
  'cursor': {
    label: 'Cursor',
    get projectConfig() { return path.join(process.cwd(), '.cursor', 'hooks.json'); },
    get globalConfig()  { return path.join(os.homedir(),  '.cursor', 'hooks.json'); },
    get projectMarker() { return path.join(process.cwd(), '.cursor'); },
    get globalMarker()  { return path.join(os.homedir(),  '.cursor'); },
    template:      path.join(TEMPLATE_DIR, 'cursor', 'hooks.template.json'),
    install:       installCursor,
    uninstall:     uninstallCursor,
  },
  'codex': {
    label: 'Codex',
    get projectConfig() { return path.join(process.cwd(), '.codex', 'hooks.json'); },
    get globalConfig()  { return path.join(os.homedir(),  '.codex', 'hooks.json'); },
    get projectMarker() { return path.join(process.cwd(), '.codex'); },
    get globalMarker()  { return path.join(os.homedir(),  '.codex'); },
    template:      path.join(TEMPLATE_DIR, 'codex', 'hooks.template.json'),
    install:       installCodex,
    uninstall:     uninstallCodex,
  },
  'hermes': {
    label: 'Hermes',
    get projectConfig() { return path.join(process.cwd(), '.hermes', 'plugins', 'agent_feedback'); },
    get globalConfig()  { return path.join(os.homedir(),  '.hermes', 'plugins', 'agent_feedback'); },
    get projectMarker() { return path.join(process.cwd(), '.hermes'); },
    get globalMarker()  { return path.join(os.homedir(),  '.hermes'); },
    install:       installHermes,
    uninstall:     uninstallHermes,
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

// ── JSON I/O helpers ────────────────────────────────────────────────────────
function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}');
  } catch (e) {
    throw new Error(`Existing config at ${filePath} is not valid JSON: ${e.message}`);
  }
}

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// ── Claude Code install ─────────────────────────────────────────────────────
// Adds a PostToolUse hook with matcher Write|Edit|MultiEdit|NotebookEdit|Create.
// Preserves any existing hooks.
function installClaudeCode(scope) {
  const h = HARNESSES['claude-code'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  const cfg = readJsonSafe(target);

  cfg.hooks = cfg.hooks || {};
  cfg.hooks.PostToolUse = cfg.hooks.PostToolUse || [];

  // Skip if our hook is already there
  const existing = cfg.hooks.PostToolUse.find(g => g[INSTALL_MARKER] === true);
  if (existing) return { changed: false, target };

  cfg.hooks.PostToolUse.push({
    matcher: 'Write|Edit|MultiEdit|NotebookEdit|Create',
    [INSTALL_MARKER]: true,
    hooks: [{ type: 'command', command: 'agent-feedback __hook', timeout: 20 }],
  });
  writeJson(target, cfg);
  return { changed: true, target };
}

function uninstallClaudeCode(scope) {
  const h = HARNESSES['claude-code'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  if (!fs.existsSync(target)) return { changed: false, target };
  const cfg = readJsonSafe(target);
  if (!cfg.hooks?.PostToolUse) return { changed: false, target };

  const before = cfg.hooks.PostToolUse.length;
  cfg.hooks.PostToolUse = cfg.hooks.PostToolUse.filter(g => g[INSTALL_MARKER] !== true);
  const after = cfg.hooks.PostToolUse.length;

  if (cfg.hooks.PostToolUse.length === 0) delete cfg.hooks.PostToolUse;
  if (Object.keys(cfg.hooks || {}).length === 0) delete cfg.hooks;

  if (before === after) return { changed: false, target };
  writeJson(target, cfg);
  return { changed: true, target };
}

// ── Cursor install ──────────────────────────────────────────────────────────
function installCursor(scope) {
  const h = HARNESSES['cursor'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  const cfg = readJsonSafe(target);

  cfg.version = cfg.version || 1;
  cfg.hooks = cfg.hooks || {};
  cfg.hooks.afterFileEdit = cfg.hooks.afterFileEdit || [];

  const existing = cfg.hooks.afterFileEdit.find(g => g[INSTALL_MARKER] === true);
  if (existing) return { changed: false, target };

  cfg.hooks.afterFileEdit.push({
    [INSTALL_MARKER]: true,
    command: 'agent-feedback __hook',
    timeout: 20,
  });
  writeJson(target, cfg);
  return { changed: true, target };
}

function uninstallCursor(scope) {
  const h = HARNESSES['cursor'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  if (!fs.existsSync(target)) return { changed: false, target };
  const cfg = readJsonSafe(target);
  if (!cfg.hooks?.afterFileEdit) return { changed: false, target };

  const before = cfg.hooks.afterFileEdit.length;
  cfg.hooks.afterFileEdit = cfg.hooks.afterFileEdit.filter(g => g[INSTALL_MARKER] !== true);
  const after = cfg.hooks.afterFileEdit.length;

  if (cfg.hooks.afterFileEdit.length === 0) delete cfg.hooks.afterFileEdit;
  if (Object.keys(cfg.hooks || {}).length === 0) delete cfg.hooks;

  if (before === after) return { changed: false, target };
  writeJson(target, cfg);
  return { changed: true, target };
}

// ── Codex install ───────────────────────────────────────────────────────────
function installCodex(scope) {
  const h = HARNESSES['codex'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  const cfg = readJsonSafe(target);

  cfg.hooks = cfg.hooks || {};
  cfg.hooks.PostToolUse = cfg.hooks.PostToolUse || [];

  const existing = cfg.hooks.PostToolUse.find(g => g[INSTALL_MARKER] === true);
  if (existing) return { changed: false, target };

  cfg.hooks.PostToolUse.push({
    matcher: '^(Write|Edit|apply_patch|create_file|str_replace)$',
    [INSTALL_MARKER]: true,
    hooks: [{ type: 'command', command: 'agent-feedback __hook', timeout: 20 }],
  });
  writeJson(target, cfg);
  return { changed: true, target };
}

function uninstallCodex(scope) {
  const h = HARNESSES['codex'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  if (!fs.existsSync(target)) return { changed: false, target };
  const cfg = readJsonSafe(target);
  if (!cfg.hooks?.PostToolUse) return { changed: false, target };

  const before = cfg.hooks.PostToolUse.length;
  cfg.hooks.PostToolUse = cfg.hooks.PostToolUse.filter(g => g[INSTALL_MARKER] !== true);
  const after = cfg.hooks.PostToolUse.length;

  if (cfg.hooks.PostToolUse.length === 0) delete cfg.hooks.PostToolUse;
  if (Object.keys(cfg.hooks || {}).length === 0) delete cfg.hooks;

  if (before === after) return { changed: false, target };
  writeJson(target, cfg);
  return { changed: true, target };
}

// ── Hermes install ──────────────────────────────────────────────────────────
// Hermes uses Python plugins. We copy the plugin folder into ~/.hermes/plugins/.
function installHermes(scope) {
  const h = HARNESSES['hermes'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;

  if (!fs.existsSync(HERMES_SRC)) {
    throw new Error(`Hermes plugin source not found at ${HERMES_SRC}`);
  }

  // Idempotency: if already installed, skip
  const sentinel = path.join(target, '.agent_feedback_managed');
  if (fs.existsSync(sentinel)) return { changed: false, target };

  fs.mkdirSync(target, { recursive: true });
  for (const file of fs.readdirSync(HERMES_SRC)) {
    fs.copyFileSync(path.join(HERMES_SRC, file), path.join(target, file));
  }
  fs.writeFileSync(sentinel, '1\n');
  return { changed: true, target };
}

function uninstallHermes(scope) {
  const h = HARNESSES['hermes'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  if (!fs.existsSync(target)) return { changed: false, target };
  const sentinel = path.join(target, '.agent_feedback_managed');
  if (!fs.existsSync(sentinel)) {
    return { changed: false, target, note: 'directory exists but was not installed by agent-feedback' };
  }
  fs.rmSync(target, { recursive: true, force: true });
  return { changed: true, target };
}

// ── Public API ──────────────────────────────────────────────────────────────
function install(harness, scope) {
  const h = HARNESSES[harness];
  if (!h) throw new Error(`Unknown harness: ${harness}`);
  return h.install(scope || 'project');
}

function uninstall(harness, scope) {
  const h = HARNESSES[harness];
  if (!h) throw new Error(`Unknown harness: ${harness}`);
  return h.uninstall(scope || 'project');
}

module.exports = {
  HARNESSES,
  detectAll,
  detectHarness,
  install,
  uninstall,
};
