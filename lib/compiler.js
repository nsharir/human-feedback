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

  const injected = `<script>\n/* ── agent-feedback: annotator.js ── */\n${script}\n</script>`;

  let output;
  if (html.includes('</body>')) {
    output = html.replace('</body>', `${injected}\n</body>`);
  } else {
    // No </body> — just append
    output = html + '\n' + injected;
  }

  // Add a small meta comment at the top so the agent can identify compiled files
  const banner = `<!-- compiled by @nsharir/agent-feedback | tool: html-annotator | source: ${path.basename(inputPath)} -->\n`;
  output = banner + output;

  writeOutput(outputPath, output);
  return { tool: 'html-annotator', linesIn: html.split('\n').length, linesOut: output.split('\n').length };
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
/* ── agent-feedback: baked markdown ── */
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

  const banner = `<!-- compiled by @nsharir/agent-feedback | tool: md-annotator | source: ${path.basename(inputPath)} -->\n`;
  output = banner + output;

  writeOutput(outputPath, output);
  return { tool: 'md-annotator', linesIn: markdown.split('\n').length, linesOut: output.split('\n').length };
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

  const banner = `<!-- compiled by @nsharir/agent-feedback | tool: feedback | source: ${path.basename(inputPath)} -->\n`;
  output = banner + output;

  writeOutput(outputPath, output);
  return {
    tool: 'feedback',
    questions: config.questions.length,
    title: config.title || '(untitled)',
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
