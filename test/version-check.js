/* test/version-check.js
   ─────────────────────────────────────────────────────────────────────────────
   Unit tests for lib/version-check.js. Uses a local http server as a
   mock GitHub API and a tempdir for the disk cache. No real network. */

'use strict';

const http = require('http');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

// Force the cache somewhere disposable before the module loads.
const TMP_CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-vc-test-'));
process.env.HUMAN_FEEDBACK_CACHE = TMP_CACHE;
// Make sure disabling env vars are NOT set during tests.
delete process.env.HUMAN_FEEDBACK_NO_UPDATE_CHECK;
delete process.env.NO_UPDATE_NOTIFIER;
delete process.env.CI;

const vc = require('../lib/version-check');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg); passed++; }
  else      { console.error('  ✗', msg); failed++; }
}

function startMock(handlers) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const h = handlers[req.url] || handlers['*'];
      if (!h) {
        res.statusCode = 404;
        res.end();
        return;
      }
      h(req, res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

function stopMock(handle) {
  return new Promise((resolve) => handle.server.close(resolve));
}

function clearCaches() {
  // Wipe any session and disk cache files between tests.
  try {
    const sess = vc._internal.sessionCachePath();
    if (fs.existsSync(sess)) fs.unlinkSync(sess);
  } catch (_) {}
  try {
    const disk = vc._internal.diskCachePath();
    if (fs.existsSync(disk)) fs.unlinkSync(disk);
  } catch (_) {}
}

// ── semver tests ────────────────────────────────────────────────────────────

function semverTests() {
  console.log('\nsemver:');
  assert(vc.compareSemver('0.1.0', '0.2.0') === -1, '0.1.0 < 0.2.0');
  assert(vc.compareSemver('0.2.0', '0.1.0') === 1,  '0.2.0 > 0.1.0');
  assert(vc.compareSemver('1.0.0', '1.0.0') === 0,  '1.0.0 == 1.0.0');
  assert(vc.compareSemver('v1.0.0', '1.0.0') === 0, 'v-prefix tolerated');
  assert(vc.compareSemver('1.0.0-beta', '1.0.0') === -1, 'beta < release');
  assert(vc.compareSemver('1.0.0-beta.2', '1.0.0-beta.10') === -1, 'numeric pre-release ordering');
  assert(vc.compareSemver('1.0.0-alpha', '1.0.0-beta') === -1, 'alpha < beta lexically');
}

// ── async tests ─────────────────────────────────────────────────────────────

async function fetchTests() {
  console.log('\nfetchLatest:');

  // 1. Outdated via /releases/latest
  {
    clearCaches();
    const mock = await startMock({
      '/repos/nsharir/human-feedback/releases/latest': (req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ tag_name: 'v9.9.9' }));
      },
    });
    const r = await vc.fetchLatest({ current: '0.1.0', apiBase: mock.base, timeout: 500 });
    assert(r && r.outdated === true, 'outdated detected via /releases/latest');
    assert(r && r.latest === '9.9.9', 'latest normalized (v stripped)');
    await stopMock(mock);
  }

  // 2. Up-to-date
  {
    clearCaches();
    const mock = await startMock({
      '/repos/nsharir/human-feedback/releases/latest': (req, res) => {
        res.end(JSON.stringify({ tag_name: '0.2.0' }));
      },
    });
    const r = await vc.fetchLatest({ current: '0.2.0', apiBase: mock.base, timeout: 500 });
    assert(r && r.outdated === false && r.ahead === false, 'up-to-date detected');
    await stopMock(mock);
  }

  // 3. Local ahead of latest
  {
    clearCaches();
    const mock = await startMock({
      '/repos/nsharir/human-feedback/releases/latest': (req, res) => {
        res.end(JSON.stringify({ tag_name: 'v0.1.0' }));
      },
    });
    const r = await vc.fetchLatest({ current: '0.2.0-dev', apiBase: mock.base, timeout: 500 });
    assert(r && r.ahead === true,    'ahead-of-latest detected (dev build)');
    assert(r && r.outdated === false, 'ahead does not also report outdated');
    await stopMock(mock);
  }

  // 4. /releases/latest 404 → fall back to /tags
  {
    clearCaches();
    const mock = await startMock({
      '/repos/nsharir/human-feedback/releases/latest': (req, res) => {
        res.statusCode = 404; res.end();
      },
      '/repos/nsharir/human-feedback/tags?per_page=30': (req, res) => {
        res.end(JSON.stringify([
          { name: 'v0.1.0' },
          { name: 'v0.2.0' },
          { name: 'random-non-version-tag' },
          { name: 'v0.1.5' },
        ]));
      },
    });
    const r = await vc.fetchLatest({ current: '0.1.0', apiBase: mock.base, timeout: 500 });
    assert(r && r.latest === '0.2.0', 'fallback to /tags picks the highest version');
    assert(r && r.outdated === true,  'outdated detected via /tags fallback');
    await stopMock(mock);
  }

  // 5. Network failure → null (unreachable host)
  {
    clearCaches();
    const r = await vc.fetchLatest({
      current: '0.1.0',
      apiBase: 'http://127.0.0.1:1', // closed port
      timeout: 200,
    });
    assert(r === null, 'unreachable host returns null (no throw)');
  }

  // 6. Timeout → null
  {
    clearCaches();
    const mock = await startMock({
      '*': (req, res) => { /* never respond */ },
    });
    const r = await vc.fetchLatest({ current: '0.1.0', apiBase: mock.base, timeout: 100 });
    assert(r === null, 'timeout returns null');
    await stopMock(mock);
  }
}

async function checkOnceTests() {
  console.log('\ncheckOnce (caching):');

  // 7. Cache hit on second call (no second network request)
  {
    clearCaches();
    let calls = 0;
    const mock = await startMock({
      '*': (req, res) => { calls++; res.end(JSON.stringify({ tag_name: 'v9.9.9' })); },
    });
    const a = await vc.checkOnce({ current: '0.1.0', apiBase: mock.base, timeout: 500 });
    const b = await vc.checkOnce({ current: '0.1.0', apiBase: mock.base, timeout: 500 });
    assert(a && a.outdated && b && b.outdated, 'both calls return outdated');
    assert(calls === 1, 'second call served from cache (only 1 network request)');
    await stopMock(mock);
  }

  // 8. Opt-out env var skips the check entirely
  {
    clearCaches();
    process.env.HUMAN_FEEDBACK_NO_UPDATE_CHECK = '1';
    let calls = 0;
    const mock = await startMock({
      '*': (req, res) => { calls++; res.end(JSON.stringify({ tag_name: 'v9.9.9' })); },
    });
    const r = await vc.checkOnce({ current: '0.1.0', apiBase: mock.base, timeout: 500 });
    assert(r === null,  'opt-out returns null');
    assert(calls === 0, 'opt-out skips the network call');
    await stopMock(mock);
    delete process.env.HUMAN_FEEDBACK_NO_UPDATE_CHECK;
  }
}

function bannerTests() {
  console.log('\nbanner formatting:');
  const banner = vc.formatBanner('0.1.0', '0.2.0');
  assert(banner.includes('0.1.0'), 'banner contains current version');
  assert(banner.includes('0.2.0'), 'banner contains latest version');
  assert(banner.includes('human-feedback update'), 'banner mentions update command');

  const marker = vc.machineMarker('0.1.0', '0.2.0');
  assert(marker === '[human-feedback:update-available current=0.1.0 latest=0.2.0]', 'machine marker shape');
}

// ── runner ──────────────────────────────────────────────────────────────────

(async () => {
  console.log('version-check tests');
  semverTests();
  bannerTests();
  await fetchTests();
  await checkOnceTests();

  console.log('');
  console.log(`  ${passed} passed, ${failed} failed`);

  // Cleanup
  try { fs.rmSync(TMP_CACHE, { recursive: true, force: true }); } catch (_) {}

  process.exit(failed === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
