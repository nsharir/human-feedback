#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
   Build process for @nsharir/agent-feedback

   Reads source files from src/, resolves @include directives, and writes
   the final templates to lib/templates/ where the compiler consumes them.

   @include syntax (works inside any file, JS or HTML):
     /* @include shared/clipboard.js *\/         in .js files
     <!-- @include shared/preview-dialog.html -->  in .html files

   Includes are resolved recursively. Paths are relative to src/.

   Run:   npm run build
   ───────────────────────────────────────────────────────────────────────────── */

'use strict';

const fs   = require('fs');
const path = require('path');

const SRC_DIR    = path.join(__dirname, '..', 'src');
const OUT_DIR    = path.join(__dirname, '..', 'lib', 'templates');
const INCLUDE_RE = /(?:\/\*\s*@include\s+([^\s*]+)\s*\*\/|<!--\s*@include\s+([^\s]+)\s*-->)/g;

const targets = [
  { src: 'tools/annotator/annotator.js',     out: 'annotator-script.js' },
  { src: 'tools/md-annotator/md-annotator.html', out: 'md-annotator.html' },
  { src: 'tools/feedback/feedback.html',     out: 'feedback.html' },
];

// ── helpers ─────────────────────────────────────────────────────────────────

function read(relPath) {
  const fullPath = path.join(SRC_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error('@include target not found: ' + relPath);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function resolveIncludes(content, currentPath, visited) {
  visited = visited || new Set();
  if (visited.has(currentPath)) {
    throw new Error('Circular @include detected at: ' + currentPath);
  }
  visited.add(currentPath);

  return content.replace(INCLUDE_RE, function (_, jsPath, htmlPath) {
    const includePath = jsPath || htmlPath;
    if (!includePath) return '';
    const included = read(includePath);
    // Recursively resolve nested includes
    return resolveIncludes(included, includePath, new Set(visited));
  });
}

function validate(out, target) {
  // Each tool must contain the QUESTIONS = null injection point (feedback only)
  // and a recognizable structure. We do per-tool validation here.
  const checks = {
    'annotator-script.js':  ['window.__annotatorLoaded'],
    'md-annotator.html':    ['<!DOCTYPE html>', 'renderMarkdown'],
    'feedback.html':        ['<!DOCTYPE html>', 'const QUESTIONS = null;'],
  };
  const required = checks[target.out] || [];
  for (const needle of required) {
    if (!out.includes(needle)) {
      throw new Error('Build output ' + target.out + ' is missing required token: ' + JSON.stringify(needle));
    }
  }
}

// ── main ────────────────────────────────────────────────────────────────────

function build() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const banner = '/* Built by build/build.js — do not edit directly. Edit sources in src/ and run `npm run build`. */\n';

  targets.forEach(function (target) {
    const srcPath = path.join(SRC_DIR, target.src);
    if (!fs.existsSync(srcPath)) {
      throw new Error('Source not found: ' + target.src);
    }
    const raw = fs.readFileSync(srcPath, 'utf8');
    const resolved = resolveIncludes(raw, target.src);

    validate(resolved, target);

    const outputPath = path.join(OUT_DIR, target.out);
    // For JS files, prefix the banner inside a comment. For HTML, use <!-- -->.
    const isJS = target.out.endsWith('.js');
    const finalOutput = isJS
      ? banner + resolved
      : '<!-- Built by build/build.js — do not edit directly. Edit sources in src/ and run `npm run build`. -->\n' + resolved;

    fs.writeFileSync(outputPath, finalOutput, 'utf8');

    const bytes = Buffer.byteLength(finalOutput);
    const kb = (bytes / 1024).toFixed(1);
    console.log('  ✓ ' + target.src + ' → lib/templates/' + target.out + '  (' + kb + ' KB)');
  });
}

try {
  console.log('Building agent-feedback templates…\n');
  build();
  console.log('\n✓ Build complete.\n');
} catch (err) {
  console.error('\n✗ Build failed: ' + err.message + '\n');
  process.exit(1);
}
