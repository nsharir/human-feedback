'use strict';
//
// Smoke test for `human-feedback help-agents`.
//
// Runs the *bundled* CLI (the canonical entrypoint shipped to end users)
// so we catch any regressions in the bundle alongside any in the source.
//

const { spawnSync } = require('child_process');
const path = require('path');
const assert = require('assert');

const cli = path.join(__dirname, '..', 'bin', 'cli.bundled.js');
const result = spawnSync('node', [cli, 'help-agents'], {
  encoding: 'utf8',
  env: { ...process.env, HUMAN_FEEDBACK_NO_UPDATE_CHECK: '1' },
});

assert.strictEqual(result.status, 0, `help-agents should exit 0, got ${result.status}; stderr=${result.stderr}`);

const out = result.stdout;

assert.match(out, /playbook for AI agents/, 'banner present');
assert.match(out, /STOP/, 'STOP gate present');
assert.match(out, /Scope/, 'scope question present');
assert.match(out, /Harness/, 'harness question present');
assert.match(out, /claude-code/, 'claude-code option listed');
assert.match(out, /cursor/, 'cursor option listed');
assert.match(out, /codex/, 'codex option listed');
assert.match(out, /hermes/, 'hermes option listed');
assert.match(out, /--all/, '--all option listed');
assert.match(out, /human-feedback install --/, 'install command shown');
assert.match(out, /human-feedback doctor/, 'doctor verification shown');
assert.match(out, /human-feedback compile/, 'compile usage shown');
assert.match(out, /file:\/\//, 'file:// link guidance present');
assert.match(out, /human-feedback update/, 'update command mentioned');

// Sanity: version line should reflect the package version.
const pkg = require('../package.json');
assert.ok(out.includes('v' + pkg.version), `output should mention v${pkg.version}`);

console.log('help-agents: ok (' + out.split('\n').length + ' lines)');
