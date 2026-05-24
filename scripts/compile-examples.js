#!/usr/bin/env node
/* Compile every input in examples/ into examples/built/ for demos. */

'use strict';

const fs   = require('fs');
const path = require('path');
const { compile, detectTool } = require('../lib/compiler');

const SRC = path.join(__dirname, '..', 'examples');
const OUT = path.join(SRC, 'built');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter(f => {
  if (f === 'built') return false;
  const ext = path.extname(f).toLowerCase();
  return ['.html', '.htm', '.md', '.markdown', '.json'].includes(ext);
});

console.log('\nCompiling examples…\n');

for (const file of files) {
  const inputPath = path.join(SRC, file);
  const tool = detectTool(file);
  if (!tool) {
    console.log(`  · skipping ${file} (unsupported extension)`);
    continue;
  }
  const suffix = tool === 'feedback' ? 'feedback'
                : tool === 'md-annotator' ? 'review'
                : 'annotated';
  const stem = path.basename(file, path.extname(file));
  const outputPath = path.join(OUT, `${stem}.${suffix}.html`);

  try {
    const result = compile(inputPath, outputPath);
    const size = (fs.statSync(outputPath).size / 1024).toFixed(1);
    console.log(`  ✓ ${file.padEnd(28)} → built/${stem}.${suffix}.html  (${size} KB, tool: ${result.tool})`);
  } catch (err) {
    console.error(`  ✗ ${file}: ${err.message}`);
  }
}

console.log('');
