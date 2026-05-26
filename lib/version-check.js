/* ─────────────────────────────────────────────────────────────────────────────
   lib/version-check.js
   ─────────────────────────────────────────────────────────────────────────────
   Lightweight version check against the GitHub Releases API. No new deps —
   uses Node's built-in https module. Designed to be cheap and silent:

     - 1500ms timeout — never delays the CLI
     - Session cache (PPID-stamped sentinel in tmpdir) so a single CLI
       invocation triggers at most one network call
     - 24h disk cache at ~/.cache/human-feedback/version-check.json
     - Honors HUMAN_FEEDBACK_NO_UPDATE_CHECK=1 and NO_UPDATE_NOTIFIER=1
     - Network/parse failures return null — never throw

   Public API:
     fetchLatest(opts)            → Promise<{current, latest, outdated} | null>
     checkOnce({pkg})             → Promise<{...} | null> (cached per-session)
     formatBanner(current,latest) → string  (boxed banner, ANSI-colored)
     compareSemver(a, b)          → -1 | 0 | 1
   ───────────────────────────────────────────────────────────────────────────── */

'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const url   = require('url');

const pc = require('picocolors');

// ── constants ───────────────────────────────────────────────────────────────

const DEFAULT_API_BASE  = 'https://api.github.com';
const DEFAULT_OWNER     = 'nsharir';
const DEFAULT_REPO      = 'human-feedback';
const REQUEST_TIMEOUT   = 1500;       // ms
const DISK_CACHE_TTL    = 24 * 60 * 60 * 1000;  // 24h
const USER_AGENT        = 'human-feedback-cli (https://github.com/nsharir/human-feedback)';

// ── env helpers ─────────────────────────────────────────────────────────────

function isCheckDisabled() {
  return (
    process.env.HUMAN_FEEDBACK_NO_UPDATE_CHECK === '1' ||
    process.env.NO_UPDATE_NOTIFIER === '1' ||
    // Standard CI heuristic — skip in non-interactive automation
    process.env.CI === 'true' || process.env.CI === '1'
  );
}

// ── semver-lite ─────────────────────────────────────────────────────────────
// Just enough to compare X.Y.Z and X.Y.Z-prerelease.
// Returns -1 if a < b, 1 if a > b, 0 if equal. Pre-releases sort before
// their corresponding release per semver (1.0.0-beta < 1.0.0).

function parseSemver(v) {
  if (typeof v !== 'string') return null;
  const cleaned = v.trim().replace(/^v/, '');
  const m = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!m) return null;
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    pre:   m[4] || null,
  };
}

function compareSemver(a, b) {
  const A = parseSemver(a);
  const B = parseSemver(b);
  if (!A && !B) return 0;
  if (!A) return -1;
  if (!B) return 1;

  if (A.major !== B.major) return A.major < B.major ? -1 : 1;
  if (A.minor !== B.minor) return A.minor < B.minor ? -1 : 1;
  if (A.patch !== B.patch) return A.patch < B.patch ? -1 : 1;

  // Pre-release: a release version (no pre) > a pre-release of the same X.Y.Z
  if (A.pre && !B.pre) return -1;
  if (!A.pre && B.pre) return 1;
  if (A.pre && B.pre) {
    // Compare each identifier alphanumerically (good-enough)
    const ap = A.pre.split('.');
    const bp = B.pre.split('.');
    const len = Math.max(ap.length, bp.length);
    for (let i = 0; i < len; i++) {
      const x = ap[i];
      const y = bp[i];
      if (x === undefined) return -1;
      if (y === undefined) return 1;
      const xn = /^\d+$/.test(x);
      const yn = /^\d+$/.test(y);
      if (xn && yn) {
        const d = parseInt(x, 10) - parseInt(y, 10);
        if (d !== 0) return d < 0 ? -1 : 1;
      } else {
        if (x < y) return -1;
        if (x > y) return 1;
      }
    }
  }
  return 0;
}

// ── cache paths ─────────────────────────────────────────────────────────────

function diskCachePath() {
  const base =
    process.env.HUMAN_FEEDBACK_CACHE ||
    process.env.XDG_CACHE_HOME ||
    path.join(os.homedir(), '.cache');
  return path.join(base, 'human-feedback', 'version-check.json');
}

function sessionCachePath() {
  // PPID-stamped so a single CLI invocation only checks once, but new
  // shells (different PPIDs) re-check.
  return path.join(os.tmpdir(), `human-feedback-vc-${process.ppid}.json`);
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (_) { return null; }
}

function writeJSON(p, data) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data), { mode: 0o600 });
  } catch (_) { /* silent */ }
}

// ── HTTP ────────────────────────────────────────────────────────────────────

function httpGetJSON(targetUrl, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    let req;
    try {
      const u = new url.URL(targetUrl);
      const transport = u.protocol === 'http:' ? http : https;
      req = transport.request({
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept':     'application/vnd.github+json',
        },
        timeout: timeoutMs,
      }, (res) => {
        // Follow one level of redirect
        if (res.statusCode === 301 || res.statusCode === 302) {
          res.resume();
          const loc = res.headers.location;
          if (loc) return httpGetJSON(loc, timeoutMs).then(done);
          return done(null);
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return done({ __status: res.statusCode });
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { body += c; if (body.length > 1024 * 1024) { req.destroy(); done(null); } });
        res.on('end',  () => { try { done(JSON.parse(body)); } catch (_) { done(null); } });
      });

      req.on('timeout', () => { req.destroy(); done(null); });
      req.on('error',   () => done(null));
      req.end();
    } catch (_) {
      done(null);
    }
  });
}

// ── public: hit the API, return resolved info ───────────────────────────────

async function fetchLatest(opts) {
  opts = opts || {};
  const currentVersion = opts.current || require('../package.json').version;
  const owner = opts.owner || DEFAULT_OWNER;
  const repo  = opts.repo  || DEFAULT_REPO;
  const apiBase = opts.apiBase || process.env.HUMAN_FEEDBACK_API_BASE || DEFAULT_API_BASE;
  const timeoutMs = opts.timeout || REQUEST_TIMEOUT;

  // Try /releases/latest first
  let release = await httpGetJSON(`${apiBase}/repos/${owner}/${repo}/releases/latest`, timeoutMs);

  // GitHub returns 404 if no releases have been published yet.
  // Fall back to git tags so a freshly-tagged-but-not-released version is still detected.
  let latestVersion = null;
  if (release && typeof release === 'object' && release.tag_name) {
    latestVersion = release.tag_name;
  } else {
    const tags = await httpGetJSON(`${apiBase}/repos/${owner}/${repo}/tags?per_page=30`, timeoutMs);
    if (Array.isArray(tags)) {
      const versions = tags
        .map(t => t && t.name)
        .filter(n => typeof n === 'string' && parseSemver(n))
        .sort((a, b) => compareSemver(b, a)); // descending
      if (versions.length) latestVersion = versions[0];
    }
  }

  if (!latestVersion) return null;

  const cmp = compareSemver(currentVersion, latestVersion);
  return {
    current:   currentVersion,
    latest:    latestVersion.replace(/^v/, ''),
    outdated:  cmp < 0,
    ahead:     cmp > 0,
    checkedAt: Date.now(),
  };
}

// ── public: cached once-per-session check ───────────────────────────────────

async function checkOnce(opts) {
  if (isCheckDisabled()) return null;

  opts = opts || {};
  const current = opts.current || (opts.pkg && opts.pkg.version) || require('../package.json').version;

  // 1. Session cache (per-PPID)
  const sessPath = sessionCachePath();
  const session  = readJSON(sessPath);
  if (session && session.current === current) {
    return session;
  }

  // 2. Disk cache (24h TTL)
  const diskPath = diskCachePath();
  const disk = readJSON(diskPath);
  if (disk && disk.current === current && (Date.now() - (disk.checkedAt || 0)) < DISK_CACHE_TTL) {
    writeJSON(sessPath, disk);
    return disk;
  }

  // 3. Live fetch
  const fresh = await fetchLatest({ ...opts, current });
  if (fresh) {
    writeJSON(diskPath, fresh);
    writeJSON(sessPath, fresh);
  }
  return fresh;
}

// ── public: banner formatting ───────────────────────────────────────────────

function visibleLength(s) {
  // Strip ANSI escapes for width math
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function pad(s, width) {
  const padLen = Math.max(0, width - visibleLength(s));
  return s + ' '.repeat(padLen);
}

function formatBanner(current, latest, opts) {
  opts = opts || {};
  const width = 60;

  const title = `${pc.bold('Update available')}  ${pc.dim(current)}  →  ${pc.bold(pc.green(latest))}`;
  const line1 = `Run  ${pc.bold(pc.cyan('human-feedback update'))}  to upgrade`;
  const line2 = pc.dim(`or ask the agent: "update human-feedback to latest"`);

  const horiz = '─'.repeat(width - 2);
  const top    = pc.dim('╭' + horiz + '╮');
  const bottom = pc.dim('╰' + horiz + '╯');
  const empty  = pc.dim('│') + ' '.repeat(width - 2) + pc.dim('│');

  const inner = (content) => pc.dim('│') + '  ' + pad(content, width - 4) + pc.dim('│');

  return [
    '',
    top,
    empty,
    inner(title),
    empty,
    inner(line1),
    inner(line2),
    empty,
    bottom,
    '',
  ].join('\n');
}

// ── public: machine-readable marker ─────────────────────────────────────────

function machineMarker(current, latest) {
  return `[human-feedback:update-available current=${current} latest=${latest}]`;
}

module.exports = {
  fetchLatest,
  checkOnce,
  formatBanner,
  machineMarker,
  compareSemver,
  parseSemver,
  // exposed for tests
  _internal: {
    diskCachePath,
    sessionCachePath,
    isCheckDisabled,
    DISK_CACHE_TTL,
  },
};
