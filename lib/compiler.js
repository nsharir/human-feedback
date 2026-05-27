'use strict';

const fs   = require('fs');
const path = require('path');

const TEMPLATES = path.join(__dirname, 'templates');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES, name), 'utf8');
}

function readInput(inputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  return fs.readFileSync(inputPath, 'utf8');
}

function writeOutput(outputPath, content) {
  const dir = path.dirname(outputPath);
  if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');
}

// Humanize a filename stem into a readable title.
//   "RD-Strategy-H2-2026-v0-nadav"  → "RD Strategy H2 2026 v0 nadav"
//   "design_doc.draft"              → "design doc draft"
function humanizeStem(stem) {
  return stem
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build the no-cache + build-stamp header injected into <head> of every
// compiled artifact. Same content for all three tools.
//
// Why this matters: the agent reuses the same output filename across feedback
// rounds (no more -r1/-r2 accumulation). Browsers happily cache file:// HTML;
// without these directives the user reloads and sees the previous round's
// content. The build-stamp comment is a human-readable sanity check (view
// source → confirm the timestamp matches the latest compile).
function buildCacheHeader(sourceBasename) {
  const builtAt = new Date().toISOString();
  return [
    '<!-- @human-feedback build-stamp: ' + builtAt + ' | source: ' + sourceBasename + ' -->',
    '<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">',
    '<meta http-equiv="Pragma" content="no-cache">',
    '<meta http-equiv="Expires" content="0">',
    '<meta name="human-feedback-built-at" content="' + builtAt + '">',
    '',
  ].join('\n');
}

// Inject the cache header right after <head> (or <head ...>). If there's no
// <head>, prepend a minimal one. Returns the modified HTML.
function injectCacheHeader(html, sourceBasename) {
  const header = buildCacheHeader(sourceBasename);
  const headOpen = html.match(/<head\b[^>]*>/i);
  if (headOpen) {
    return html.replace(headOpen[0], headOpen[0] + '\n' + header);
  }
  // No <head> — synthesize one before <body> or at the top.
  if (/<body\b/i.test(html)) {
    return html.replace(/<body\b/i, '<head>\n' + header + '\n</head>\n<body');
  }
  return '<head>\n' + header + '\n</head>\n' + html;
}

// Replace the <title> tag (or inject one) with the supplied title.
function setHtmlTitle(html, title) {
  const safe = escapeHtml(title);
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '<title>' + safe + '</title>');
  }
  // No <title> — inject after <head>.
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (m) => m + '\n<title>' + safe + '</title>');
  }
  return html;
}

// Derive a sensible title for the compiled artifact.
//   1. caller-provided override
//   2. otherwise the humanized stem of the SOURCE filename
function deriveTitle(inputPath, override) {
  if (override && String(override).trim()) return String(override).trim();
  const stem = path.basename(inputPath, path.extname(inputPath));
  return humanizeStem(stem);
}

// Extract the first H1 from a markdown document, if any.
function extractMarkdownH1(md) {
  const m = md.match(/^[ \t]*#[ \t]+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

// Extract the <title>…</title> text from an HTML document, if any.
function extractHtmlTitle(html) {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const t = m[1].replace(/\s+/g, ' ').trim();
  return t || null;
}

// ── Detect tool from file extension ──────────────────────────────────────────

function detectTool(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  switch (ext) {
    case '.html':
    case '.htm':
      return 'annotator';
    case '.md':
    case '.markdown':
      return 'md-annotator';
    case '.json':
      return 'feedback';
    default:
      return null;
  }
}

// ── Transform 1: HTML Annotator ───────────────────────────────────────────────
//   Input:  any static .html file
//   Output: same HTML with annotator.js inlined before </body>

function compileAnnotator(inputPath, outputPath) {
  const html   = readInput(inputPath);
  const script = readTemplate('annotator-script.js');

  // Defensively escape any literal </script> in the script body so the host
  // HTML parser doesn't close our injected <script> tag early.
  const safeScript = script.replace(/<\/script>/gi, '<\\/script>');

  const injected = `<script>\n/* ── human-feedback: annotator.js ── */\n${safeScript}\n<\/script>`;

  let output;
  if (html.includes('</body>')) {
    output = html.replace('</body>', `${injected}\n</body>`);
  } else {
    // No </body> — just append
    output = html + '\n' + injected;
  }

  // Title: prefer the source HTML's own <title>, else humanized filename stem.
  const title = extractHtmlTitle(html) || deriveTitle(inputPath);
  output = setHtmlTitle(output, title);

  // Inject no-cache headers + build-stamp into <head>.
  output = injectCacheHeader(output, path.basename(inputPath));

  // Add a small meta comment at the top so the agent can identify compiled files
  const banner = `<!-- compiled by @nsharir/human-feedback | tool: html-annotator | source: ${path.basename(inputPath)} -->\n`;
  output = banner + output;

  writeOutput(outputPath, output);
  return { tool: 'html-annotator', title, linesIn: html.split('\n').length, linesOut: output.split('\n').length };
}

// ── Transform 2: Markdown Annotator ──────────────────────────────────────────
//   Input:  a .md file
//   Output: md-annotator.html with the markdown baked in (auto-loads on open)

function compileMdAnnotator(inputPath, outputPath) {
  const markdown = readInput(inputPath);
  let   template = readTemplate('md-annotator.html');

  // Escape backticks and backslashes so the markdown is safe inside a JS template literal
  const escaped = markdown
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  // Inject: replace the renderMarkdown call stub with an auto-render on load
  // We append a small <script> block before </body> that calls renderMarkdown()
  // with the baked-in content.
  const autoLoad = `
<script>
/* ── human-feedback: baked markdown ── */
(function () {
  var baked = \`${escaped}\`;
  // Wait for the engine to be ready
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof renderMarkdown === 'function') {
      renderMarkdown(baked);
    }
  });
})();
</script>`;

  let output;
  if (template.includes('</body>')) {
    output = template.replace('</body>', autoLoad + '\n</body>');
  } else {
    output = template + autoLoad;
  }

  // Title: prefer the markdown's first H1, else humanized filename stem.
  const title = extractMarkdownH1(markdown) || deriveTitle(inputPath);
  output = setHtmlTitle(output, title);

  // Inject no-cache headers + build-stamp into <head>.
  output = injectCacheHeader(output, path.basename(inputPath));

  const banner = `<!-- compiled by @nsharir/human-feedback | tool: md-annotator | source: ${path.basename(inputPath)} -->\n`;
  output = banner + output;

  writeOutput(outputPath, output);
  return { tool: 'md-annotator', title, linesIn: markdown.split('\n').length, linesOut: output.split('\n').length };
}

// ── Transform 3: Feedback ─────────────────────────────────────────────────────
//   Input:  a questions .json file
//   Output: feedback.html with QUESTIONS = null replaced by the real config

function compileFeedback(inputPath, outputPath) {
  const raw      = readInput(inputPath);
  let   template = readTemplate('feedback.html');

  // Validate JSON
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${inputPath}: ${e.message}`);
  }

  // Validate schema minimally
  if (!config.questions || !Array.isArray(config.questions)) {
    throw new Error(`JSON must have a "questions" array. See README for schema.`);
  }
  if (config.questions.length === 0) {
    throw new Error(`"questions" array is empty.`);
  }

  // Validate question types
  const validTypes = ['text','textarea','radio','checkbox','select','boolean','scale','range','date'];
  config.questions.forEach((q, i) => {
    if (!q.id)   throw new Error(`Question at index ${i} is missing "id".`);
    if (!q.text) throw new Error(`Question "${q.id}" is missing "text".`);
    const t = q.type || 'text';
    if (!validTypes.includes(t)) throw new Error(`Question "${q.id}" has unknown type "${t}". Valid: ${validTypes.join(', ')}`);
    if (['radio','checkbox','select'].includes(t) && (!q.options || !q.options.length)) {
      throw new Error(`Question "${q.id}" (type: ${t}) requires an "options" array.`);
    }
  });

  // Replace the placeholder
  const placeholder = 'const QUESTIONS = null;';
  if (!template.includes(placeholder)) {
    throw new Error(`Template is missing the injection point: "${placeholder}"`);
  }

  const injected = `const QUESTIONS = ${JSON.stringify(config, null, 2)};`;
  let output = template.replace(placeholder, injected);

  // Title: prefer config.title, else humanized filename stem.
  const title = deriveTitle(inputPath, config.title);
  output = setHtmlTitle(output, title);

  // Inject no-cache headers + build-stamp into <head>.
  output = injectCacheHeader(output, path.basename(inputPath));

  const banner = `<!-- compiled by @nsharir/human-feedback | tool: feedback | source: ${path.basename(inputPath)} -->\n`;
  output = banner + output;

  writeOutput(outputPath, output);
  return {
    tool: 'feedback',
    questions: config.questions.length,
    title,
    linesOut: output.split('\n').length,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

function compile(inputPath, outputPath, forceTool) {
  const tool = forceTool || detectTool(inputPath);

  if (!tool) {
    throw new Error(
      `Cannot detect tool from extension "${path.extname(inputPath)}". ` +
      `Supported: .html/.htm → annotator, .md/.markdown → md-annotator, .json → feedback.\n` +
      `Use --tool <name> to override.`
    );
  }

  switch (tool) {
    case 'annotator':
    case 'html-annotator':
      return compileAnnotator(inputPath, outputPath);
    case 'md-annotator':
    case 'markdown':
      return compileMdAnnotator(inputPath, outputPath);
    case 'feedback':
    case 'questioner': // keep as alias for backwards compat
      return compileFeedback(inputPath, outputPath);
    default:
      throw new Error(`Unknown tool: "${tool}". Valid values: annotator, md-annotator, feedback.`);
  }
}

module.exports = { compile, detectTool };
