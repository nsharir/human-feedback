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
// Adds three managed groups:
//   - PostToolUse  — wraps written files (auto-wrap + auto-open)
//   - SessionStart — injects the >1-question rule into every new session
//   - UserPromptSubmit — re-injects the rule before each user prompt
// All groups are tagged with INSTALL_MARKER so uninstall removes only ours.
function installClaudeCode(scope) {
  const h = HARNESSES['claude-code'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  const cfg = readJsonSafe(target);

  cfg.hooks = cfg.hooks || {};

  let changed = false;

  // PostToolUse — auto-wrap
  cfg.hooks.PostToolUse = cfg.hooks.PostToolUse || [];
  if (!cfg.hooks.PostToolUse.find(g => g[INSTALL_MARKER] === true)) {
    cfg.hooks.PostToolUse.push({
      matcher: 'Write|Edit|MultiEdit|NotebookEdit|Create',
      [INSTALL_MARKER]: true,
      hooks: [{ type: 'command', command: 'agent-feedback __hook', timeout: 20 }],
    });
    changed = true;
  }

  // SessionStart — rule injection on every new session
  cfg.hooks.SessionStart = cfg.hooks.SessionStart || [];
  if (!cfg.hooks.SessionStart.find(g => g[INSTALL_MARKER] === true)) {
    cfg.hooks.SessionStart.push({
      [INSTALL_MARKER]: true,
      hooks: [{ type: 'command', command: 'agent-feedback __hook', timeout: 10 }],
    });
    changed = true;
  }

  // UserPromptSubmit — re-inject the rule before each user prompt
  cfg.hooks.UserPromptSubmit = cfg.hooks.UserPromptSubmit || [];
  if (!cfg.hooks.UserPromptSubmit.find(g => g[INSTALL_MARKER] === true)) {
    cfg.hooks.UserPromptSubmit.push({
      [INSTALL_MARKER]: true,
      hooks: [{ type: 'command', command: 'agent-feedback __hook', timeout: 10 }],
    });
    changed = true;
  }

  if (changed) writeJson(target, cfg);
  return { changed, target };
}

function uninstallClaudeCode(scope) {
  const h = HARNESSES['claude-code'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  if (!fs.existsSync(target)) return { changed: false, target };
  const cfg = readJsonSafe(target);
  if (!cfg.hooks) return { changed: false, target };

  let changed = false;
  for (const key of ['PostToolUse', 'SessionStart', 'UserPromptSubmit']) {
    if (!Array.isArray(cfg.hooks[key])) continue;
    const before = cfg.hooks[key].length;
    cfg.hooks[key] = cfg.hooks[key].filter(g => g[INSTALL_MARKER] !== true);
    if (cfg.hooks[key].length !== before) changed = true;
    if (cfg.hooks[key].length === 0) delete cfg.hooks[key];
  }

  if (Object.keys(cfg.hooks || {}).length === 0) delete cfg.hooks;

  if (!changed) return { changed: false, target };
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

  let changed = false;

  // afterFileEdit — auto-wrap
  cfg.hooks.afterFileEdit = cfg.hooks.afterFileEdit || [];
  if (!cfg.hooks.afterFileEdit.find(g => g[INSTALL_MARKER] === true)) {
    cfg.hooks.afterFileEdit.push({
      [INSTALL_MARKER]: true,
      command: 'agent-feedback __hook',
      timeout: 20,
    });
    changed = true;
  }

  // beforeSubmitPrompt — inject the >1-question rule before each prompt
  cfg.hooks.beforeSubmitPrompt = cfg.hooks.beforeSubmitPrompt || [];
  if (!cfg.hooks.beforeSubmitPrompt.find(g => g[INSTALL_MARKER] === true)) {
    cfg.hooks.beforeSubmitPrompt.push({
      [INSTALL_MARKER]: true,
      command: 'agent-feedback __hook',
      timeout: 10,
    });
    changed = true;
  }

  if (changed) writeJson(target, cfg);
  return { changed, target };
}

function uninstallCursor(scope) {
  const h = HARNESSES['cursor'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  if (!fs.existsSync(target)) return { changed: false, target };
  const cfg = readJsonSafe(target);
  if (!cfg.hooks) return { changed: false, target };

  let changed = false;
  for (const key of ['afterFileEdit', 'beforeSubmitPrompt']) {
    if (!Array.isArray(cfg.hooks[key])) continue;
    const before = cfg.hooks[key].length;
    cfg.hooks[key] = cfg.hooks[key].filter(g => g[INSTALL_MARKER] !== true);
    if (cfg.hooks[key].length !== before) changed = true;
    if (cfg.hooks[key].length === 0) delete cfg.hooks[key];
  }

  if (Object.keys(cfg.hooks || {}).length === 0) delete cfg.hooks;

  if (!changed) return { changed: false, target };
  writeJson(target, cfg);
  return { changed: true, target };
}

// ── Codex install ───────────────────────────────────────────────────────────
// Same structure as Claude Code: PostToolUse + SessionStart + UserPromptSubmit.
function installCodex(scope) {
  const h = HARNESSES['codex'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  const cfg = readJsonSafe(target);

  cfg.hooks = cfg.hooks || {};

  let changed = false;

  cfg.hooks.PostToolUse = cfg.hooks.PostToolUse || [];
  if (!cfg.hooks.PostToolUse.find(g => g[INSTALL_MARKER] === true)) {
    cfg.hooks.PostToolUse.push({
      matcher: '^(Write|Edit|apply_patch|create_file|str_replace)$',
      [INSTALL_MARKER]: true,
      hooks: [{ type: 'command', command: 'agent-feedback __hook', timeout: 20 }],
    });
    changed = true;
  }

  cfg.hooks.SessionStart = cfg.hooks.SessionStart || [];
  if (!cfg.hooks.SessionStart.find(g => g[INSTALL_MARKER] === true)) {
    cfg.hooks.SessionStart.push({
      [INSTALL_MARKER]: true,
      hooks: [{ type: 'command', command: 'agent-feedback __hook', timeout: 10 }],
    });
    changed = true;
  }

  cfg.hooks.UserPromptSubmit = cfg.hooks.UserPromptSubmit || [];
  if (!cfg.hooks.UserPromptSubmit.find(g => g[INSTALL_MARKER] === true)) {
    cfg.hooks.UserPromptSubmit.push({
      [INSTALL_MARKER]: true,
      hooks: [{ type: 'command', command: 'agent-feedback __hook', timeout: 10 }],
    });
    changed = true;
  }

  if (changed) writeJson(target, cfg);
  return { changed, target };
}

function uninstallCodex(scope) {
  const h = HARNESSES['codex'];
  const target = scope === 'global' ? h.globalConfig : h.projectConfig;
  if (!fs.existsSync(target)) return { changed: false, target };
  const cfg = readJsonSafe(target);
  if (!cfg.hooks) return { changed: false, target };

  let changed = false;
  for (const key of ['PostToolUse', 'SessionStart', 'UserPromptSubmit']) {
    if (!Array.isArray(cfg.hooks[key])) continue;
    const before = cfg.hooks[key].length;
    cfg.hooks[key] = cfg.hooks[key].filter(g => g[INSTALL_MARKER] !== true);
    if (cfg.hooks[key].length !== before) changed = true;
    if (cfg.hooks[key].length === 0) delete cfg.hooks[key];
  }

  if (Object.keys(cfg.hooks || {}).length === 0) delete cfg.hooks;

  if (!changed) return { changed: false, target };
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
