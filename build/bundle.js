#!/usr/bin/env node
// Bundles bin/cli.js + runtime deps into a single bin/cli.bundled.js.
// Uses esbuild's JS API with explicit aliases to bypass any ancestor
// Yarn PnP manifest (e.g. a stray ~/.pnp.cjs) that would otherwise
// interfere with module resolution.
'use strict';

const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'bin', 'cli.js');
const outfile = path.join(root, 'bin', 'cli.bundled.js');

// Pre-resolve runtime deps from the project's node_modules so we never
// fall back to PnP ancestor lookups.
function resolveDep(name) {
  return require.resolve(name, { paths: [root] });
}

const alias = {
  commander: resolveDep('commander'),
  picocolors: resolveDep('picocolors'),
};

esbuild
  .build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    banner: { js: '/* Built by build/bundle.js — do not edit directly. Edit bin/cli.js and run `npm run build:bundle`. */' },
    alias,
    absWorkingDir: root,
    logLevel: 'info',
  })
  .then(() => {
    fs.chmodSync(outfile, 0o755);
    console.log(`✓ wrote ${path.relative(root, outfile)}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
