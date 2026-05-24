#!/usr/bin/env node
/* eslint-disable no-console */
/*
 * scripts/record-demo.js
 * ------------------------------------------------------------------
 * Records a short animated GIF demo of one of the annotator tools.
 *
 * Usage:
 *   NODE_PATH=/path/to/hermes/node_modules node scripts/record-demo.js <tool>
 *
 *   <tool>   one of: md-annotator | html-annotator | feedback
 *
 * Outputs:
 *   examples/demos/<tool>.gif
 *
 * Requirements (NOT npm-installed in this repo):
 *   - Playwright (any 1.5x+) accessible via NODE_PATH
 *   - ffmpeg in PATH (uses two-pass palette method)
 *
 * The script:
 *   1. Launches Chromium with video recording.
 *   2. Drives a scripted demo flow per tool.
 *   3. Converts the resulting WebM to a 640px-wide GIF via ffmpeg.
 *
 * Cursor: A small fake cursor div is injected so mouse motion is visible
 *   (Playwright videos don't capture the OS cursor).
 * ------------------------------------------------------------------ */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');

const TOOLS = {
  'md-annotator': {
    file: path.join(REPO, 'examples/built/email-client-spec.review.html'),
    flow: mdAnnotatorFlow,
  },
  // Placeholders so the other subagents can fill these in:
  'html-annotator': {
    file: path.join(REPO, 'examples/built/email-client-mockup.annotated.html'),
    flow: async () => { throw new Error('html-annotator flow not implemented yet'); },
  },
  feedback: {
    file: path.join(REPO, 'examples/built/feedback-form.feedback.html'),
    flow: async () => { throw new Error('feedback flow not implemented yet'); },
  },
};

// ────────────────────────────────────────────────────────────────────
// Fake cursor — injected into the page so mouse motion is visible in
// the video recording (Playwright otherwise records no cursor).
// ────────────────────────────────────────────────────────────────────
const CURSOR_INIT = `
(() => {
  if (window.__fakeCursorInstalled) return;
  window.__fakeCursorInstalled = true;
  const c = document.createElement('div');
  c.id = '__fake_cursor';
  c.style.cssText = [
    'position:fixed','left:0','top:0','width:20px','height:20px',
    'pointer-events:none','z-index:2147483647',
    "background:url(\\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M2 2 L2 17 L6 13 L9 19 L11 18 L8 12 L14 12 Z' fill='black' stroke='white' stroke-width='1'/></svg>\\") no-repeat",
    'background-size:contain',
    'transition:left 30ms linear, top 30ms linear',
  ].join(';');
  document.documentElement.appendChild(c);
  window.__moveCursor = (x, y) => {
    c.style.left = (x - 2) + 'px';
    c.style.top  = (y - 2) + 'px';
  };
  // Wire it to real mouse events as a fallback
  document.addEventListener('mousemove', e => window.__moveCursor(e.clientX, e.clientY), true);
})();
`;

async function moveCursor(page, x, y, steps = 16) {
  // Smooth move both Playwright mouse and the fake cursor div
  const start = await page.evaluate(() => {
    const c = document.getElementById('__fake_cursor');
    if (!c) return { x: 0, y: 0 };
    return { x: parseFloat(c.style.left) || 0, y: parseFloat(c.style.top) || 0 };
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = start.x + (x - start.x) * t;
    const cy = start.y + (y - start.y) * t;
    await page.evaluate(([X, Y]) => window.__moveCursor(X, Y), [cx, cy]);
    await page.waitForTimeout(15);
  }
  await page.mouse.move(x, y);
}

async function sleep(page, ms) { await page.waitForTimeout(ms); }

// ────────────────────────────────────────────────────────────────────
// md-annotator demo flow
// ────────────────────────────────────────────────────────────────────
async function mdAnnotatorFlow(page) {
  // Wait until the markdown has rendered
  await page.waitForFunction(() => {
    const p = document.querySelector('#preview');
    return p && p.innerText && p.innerText.length > 200;
  }, { timeout: 10000 });

  await sleep(page, 400);

  // Scroll to the providers section so we can interact with it
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('#preview h2'));
    const target = headings.find(h => /Supported providers/i.test(h.textContent));
    if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await sleep(page, 700);

  // ── First annotation: select the iCloud sentence (Generic IMAP/SMTP line) ─
  const sel1 = await page.evaluate(() => {
    const lis = Array.from(document.querySelectorAll('#preview li'));
    const li = lis.find(n => /Generic IMAP\/SMTP/i.test(n.textContent));
    if (!li) return null;
    // Find the text node containing "Fastmail, iCloud, custom domains"
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.data.indexOf('Fastmail');
      if (i >= 0) {
        const j = node.data.indexOf(')', i);
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, j >= 0 ? j : node.data.length);
        const rect = range.getBoundingClientRect();
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return { x: rect.right, y: rect.bottom };
      }
    }
    return null;
  });
  if (!sel1) throw new Error('Could not locate first selection target');

  // Move fake cursor to the selection end and fire a real mouseup so the
  // app's mouseup listener picks up the selection and opens the popover.
  await moveCursor(page, sel1.x, sel1.y);
  await page.mouse.down();
  await page.mouse.up();
  await sleep(page, 500);

  // The app sometimes requires a real selection-driven mouseup. Re-create
  // the selection and dispatch mouseup on the preview to be safe.
  await page.evaluate(() => {
    const preview = document.getElementById('preview');
    const lis = Array.from(document.querySelectorAll('#preview li'));
    const li = lis.find(n => /Generic IMAP\/SMTP/i.test(n.textContent));
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.data.indexOf('Fastmail');
      if (i >= 0) {
        const j = node.data.indexOf(')', i);
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, j >= 0 ? j : node.data.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const rect = range.getBoundingClientRect();
        preview.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true, clientX: rect.right, clientY: rect.bottom,
        }));
        return;
      }
    }
  });

  // Wait for popover
  await page.waitForSelector('#comment-pop.open', { timeout: 4000 });
  await sleep(page, 350);

  // Type the comment
  await page.focus('#pop-input');
  await page.keyboard.type('What about iCloud setup notes?', { delay: 20 });
  await sleep(page, 250);

  // Click Save
  const saveBtn = await page.locator('#pop-save').boundingBox();
  if (saveBtn) await moveCursor(page, saveBtn.x + saveBtn.width / 2, saveBtn.y + saveBtn.height / 2);
  await page.click('#pop-save');
  await sleep(page, 700);

  // ── Second annotation: select "Snooze" sentence ─────────────────────
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('#preview h3'));
    const target = headings.find(h => /Snooze/i.test(h.textContent));
    if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await sleep(page, 500);

  const sel2 = await page.evaluate(() => {
    const lis = Array.from(document.querySelectorAll('#preview li'));
    const li = lis.find(n => /local-only flag/i.test(n.textContent));
    if (!li) return null;
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.data.indexOf('local-only flag');
      if (i >= 0) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 'local-only flag'.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const rect = range.getBoundingClientRect();
        document.getElementById('preview').dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true, clientX: rect.right, clientY: rect.bottom,
        }));
        return { x: rect.right, y: rect.bottom };
      }
    }
    return null;
  });
  if (sel2) await moveCursor(page, sel2.x, sel2.y);

  await page.waitForSelector('#comment-pop.open', { timeout: 4000 });
  await sleep(page, 300);

  await page.focus('#pop-input');
  await page.keyboard.type('Can we soften this?', { delay: 20 });
  await sleep(page, 200);
  await page.click('#pop-save');
  await sleep(page, 700);

  // ── Open the side panel via the FAB ────────────────────────────────
  const fab = await page.locator('#ann-shared-fab').boundingBox();
  if (fab) await moveCursor(page, fab.x + fab.width / 2, fab.y + fab.height / 2);
  await page.click('#ann-shared-fab');
  await sleep(page, 900);

  // ── Copy Prompt to open the preview dialog ─────────────────────────
  const cp = await page.locator('#ann-copy-prompt').boundingBox();
  if (cp) await moveCursor(page, cp.x + cp.width / 2, cp.y + cp.height / 2);
  await page.click('#ann-copy-prompt');
  await sleep(page, 900);
}

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────
(async () => {
  const toolName = process.argv[2] || 'md-annotator';
  const tool = TOOLS[toolName];
  if (!tool) {
    console.error(`Unknown tool: ${toolName}. Choices: ${Object.keys(TOOLS).join(', ')}`);
    process.exit(2);
  }
  if (!fs.existsSync(tool.file)) {
    console.error(`Demo source file missing: ${tool.file}`);
    process.exit(2);
  }

  const outDir = path.join(REPO, 'examples/demos');
  fs.mkdirSync(outDir, { recursive: true });
  const videoDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'demo-vid-'));

  const VIEW = { width: 1280, height: 800 };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEW,
    recordVideo: { dir: videoDir, size: VIEW },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto('file://' + tool.file);
  await page.evaluate(CURSOR_INIT);
  await sleep(page, 300);

  try {
    await tool.flow(page);
  } catch (e) {
    console.error('Flow failed:', e);
    await page.screenshot({ path: path.join(outDir, `${toolName}-error.png`) });
  }

  await sleep(page, 400);
  await page.close(); // flush video
  await context.close();
  await browser.close();

  // Find the recorded video
  const videos = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
  if (!videos.length) {
    console.error('No video produced.');
    process.exit(1);
  }
  const webm = path.join(videoDir, videos[0]);
  const gif = path.join(outDir, `${toolName}.gif`);
  const palette = path.join(videoDir, 'palette.png');

  console.log(`Video: ${webm}`);
  console.log('Generating palette ...');
  let r = spawnSync('ffmpeg', [
    '-y', '-i', webm,
    '-vf', 'fps=14,scale=640:-1:flags=lanczos,palettegen=stats_mode=diff',
    palette,
  ], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);

  console.log('Encoding GIF ...');
  r = spawnSync('ffmpeg', [
    '-y', '-i', webm, '-i', palette,
    '-lavfi', 'fps=14,scale=640:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5',
    '-loop', '0',
    gif,
  ], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);

  const sz = fs.statSync(gif).size;
  console.log(`\nWrote ${gif} (${(sz / 1024).toFixed(1)} KB)`);
  if (sz > 3 * 1024 * 1024) {
    console.warn('⚠ GIF exceeds 3 MB — consider lowering fps or width.');
  }
})();
