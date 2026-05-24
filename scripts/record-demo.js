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
    flow: htmlAnnotatorFlow,
  },
  feedback: {
    file: path.join(REPO, 'examples/built/email-client-requirements.feedback.html'),
    flow: feedbackFlow,
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
//   1. select text → type comment → save (A1 appears)
//   2. select another text → type comment → save (A2 appears)
//   3. click annotation A1's floating label → side panel opens, A1 focused
//   4. click "Copy Prompt" button → preview dialog opens with full prompt
//   5. brief pause showing the prompt
//   6. click "Copy to Clipboard" in the dialog
// ────────────────────────────────────────────────────────────────────
async function selectAndComment(page, predicate, needle, comment) {
  // Build a Range over the `needle` substring inside the first element
  // matched by `predicate`, set it as the window selection, and dispatch
  // a real `mouseup` on #preview so the app's listener opens the popover.
  const rect = await page.evaluate(({ predicateStr, needle }) => {
    const matchFn = new Function('n', 'return ' + predicateStr);
    const candidates = Array.from(document.querySelectorAll('#preview p,#preview li,#preview h2,#preview h3,#preview h4'));
    const node = candidates.find(matchFn);
    if (!node) return null;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const i = n.data.indexOf(needle);
      if (i >= 0) {
        const range = document.createRange();
        range.setStart(n, i);
        range.setEnd(n, i + needle.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const r = range.getBoundingClientRect();
        // Scroll the selection into mid-viewport
        if (r.top < 100 || r.bottom > 700) {
          window.scrollTo({ top: window.scrollY + r.top - 250, behavior: 'instant' });
        }
        const r2 = range.getBoundingClientRect();
        document.getElementById('preview').dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true, clientX: r2.right, clientY: r2.bottom,
        }));
        return { x: r2.right, y: r2.bottom };
      }
    }
    return null;
  }, { predicateStr: predicate, needle });

  if (!rect) throw new Error(`Could not locate text "${needle}"`);

  await moveCursor(page, rect.x, rect.y);
  await page.waitForSelector('#comment-pop.open', { timeout: 5000 });
  await sleep(page, 600);

  // Type the comment with visible delay
  await page.focus('#pop-input');
  await page.keyboard.type(comment, { delay: 45 });
  await sleep(page, 500);

  // Move cursor to Save then click
  const saveBtn = await page.locator('#pop-save').boundingBox();
  if (saveBtn) await moveCursor(page, saveBtn.x + saveBtn.width / 2, saveBtn.y + saveBtn.height / 2);
  await sleep(page, 200);
  await page.click('#pop-save');
  await sleep(page, 900);
}

async function mdAnnotatorFlow(page) {
  // Wait until the markdown has rendered
  await page.waitForFunction(() => {
    const p = document.querySelector('#preview');
    return p && p.innerText && p.innerText.length > 200;
  }, { timeout: 10000 });

  await sleep(page, 800);

  // ── ANNOTATION 1 ────────────────────────────────────────────────────
  // Scroll to "Supported providers" then select the IMAP line
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('#preview h2'));
    const target = headings.find(h => /Supported providers/i.test(h.textContent));
    if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await sleep(page, 800);

  await selectAndComment(
    page,
    "/Generic IMAP\\/SMTP/i.test(n.textContent)",
    'Fastmail, iCloud, custom domains',
    'Add Fastmail setup notes'
  );

  // ── ANNOTATION 2 ────────────────────────────────────────────────────
  await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('#preview h3'));
    const target = headings.find(h => /Snooze/i.test(h.textContent));
    if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await sleep(page, 700);

  await selectAndComment(
    page,
    "/local-only flag/i.test(n.textContent)",
    'local-only flag',
    'Sync via iCloud instead?'
  );

  // ── CLICK ON THE A1 FLOATING LABEL ─────────────────────────────────
  // Scroll back up so A1's label is visible, then click it.
  await page.evaluate(() => {
    const lbl = document.querySelector('.ann-label');
    if (lbl) lbl.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await sleep(page, 700);

  const labelBox = await page.locator('.ann-label').first().boundingBox();
  if (labelBox) {
    await moveCursor(page, labelBox.x + labelBox.width / 2, labelBox.y + labelBox.height / 2);
    await sleep(page, 300);
    await page.locator('.ann-label').first().click();
    await sleep(page, 1100); // panel slides in, A1 card flashes
  }

  // ── CLICK "Copy Prompt" ────────────────────────────────────────────
  const cp = await page.locator('#ann-copy-prompt').boundingBox();
  if (cp) {
    await moveCursor(page, cp.x + cp.width / 2, cp.y + cp.height / 2);
    await sleep(page, 300);
  }
  await page.click('#ann-copy-prompt');
  await sleep(page, 1300); // dialog opens

  // ── SHOW THE PROMPT, then click the Copy to Clipboard button ───────
  // Scroll the textarea a bit so the user can read it
  await page.evaluate(() => {
    const ta = document.getElementById('preview-textarea');
    if (ta) { ta.scrollTop = 0; }
  });
  await sleep(page, 1200);

  await page.evaluate(() => {
    const ta = document.getElementById('preview-textarea');
    if (ta) ta.scrollTop = 120;
  });
  await sleep(page, 700);

  // Click "Copy to Clipboard"
  const copyBtn = await page.locator('#preview-copy').boundingBox();
  if (copyBtn) {
    await moveCursor(page, copyBtn.x + copyBtn.width / 2, copyBtn.y + copyBtn.height / 2);
    await sleep(page, 300);
  }
  await page.click('#preview-copy');
  await sleep(page, 1500); // show success state / toast
}

// ────────────────────────────────────────────────────────────────────
// html-annotator demo flow
//   The html-annotator injects an annotator UI over a rendered HTML
//   mockup. In annotation mode, clicking on any non-annotator element
//   opens the comment dialog. We:
//     1. click the "Compose" button → comment → save (A1 pin appears)
//     2. click the AI-summary card  → comment → save (A2 pin appears)
//     3. click annotation #1's pin  → side panel slides in
//     4. click "Copy Prompt"        → preview dialog opens
//     5. click "Copy to Clipboard"
// ────────────────────────────────────────────────────────────────────
async function clickElementAndComment(page, selector, comment) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`Could not find ${selector}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await moveCursor(page, x, y);
  await sleep(page, 250);
  await page.locator(selector).first().click();
  await page.waitForSelector('#ann-dialog', { state: 'visible', timeout: 5000 });
  await sleep(page, 600);
  await page.focus('#ann-dialog-input');
  await page.keyboard.type(comment, { delay: 45 });
  await sleep(page, 500);
  const saveBox = await page.locator('#ann-dialog-save').boundingBox();
  if (saveBox) await moveCursor(page, saveBox.x + saveBox.width / 2, saveBox.y + saveBox.height / 2);
  await sleep(page, 250);
  await page.click('#ann-dialog-save');
  await page.waitForSelector('#ann-dialog', { state: 'hidden', timeout: 5000 });
  await sleep(page, 700);
}

async function htmlAnnotatorFlow(page) {
  // Wait for the host mockup to render and annotator to mount
  await page.waitForSelector('#ann-fab, #ann-toolbar', { timeout: 10000 });
  await page.waitForSelector('.compose-btn', { timeout: 10000 });
  await sleep(page, 800);

  // ── ANNOTATION 1 — click the Compose button ─────────────────────────
  await clickElementAndComment(page, '.compose-btn', 'Make this button bigger');

  // ── ANNOTATION 2 — click the AI summary card ────────────────────────
  await clickElementAndComment(page, '.ai-summary', 'Drop the AI summary block here');

  // ── CLICK ON THE A1 PIN to open the side panel ─────────────────────
  const pin = page.locator('.ann-pin[data-ann-id="1"]').first();
  await pin.scrollIntoViewIfNeeded();
  await sleep(page, 400);
  const pinBox = await pin.boundingBox();
  if (pinBox) {
    await moveCursor(page, pinBox.x + pinBox.width / 2, pinBox.y + pinBox.height / 2);
    await sleep(page, 300);
  }
  await pin.click();
  await page.waitForSelector('#ann-panel.open', { timeout: 5000 });
  await sleep(page, 1100);

  // ── CLICK "Copy Prompt" ───────────────────────────────────────────
  const cp = await page.locator('#ann-copy-prompt').boundingBox();
  if (cp) {
    await moveCursor(page, cp.x + cp.width / 2, cp.y + cp.height / 2);
    await sleep(page, 300);
  }
  await page.click('#ann-copy-prompt');
  await page.waitForSelector('#ann-preview-overlay.open', { timeout: 5000 });
  await sleep(page, 1300);

  // Brief pause showing the prompt
  await page.evaluate(() => {
    const ta = document.getElementById('ann-preview-textarea');
    if (ta) ta.scrollTop = 80;
  });
  await sleep(page, 900);

  // ── CLICK "Copy to Clipboard" ──────────────────────────────────────
  const copyBtn = await page.locator('#ann-preview-copy').boundingBox();
  if (copyBtn) {
    await moveCursor(page, copyBtn.x + copyBtn.width / 2, copyBtn.y + copyBtn.height / 2);
    await sleep(page, 300);
  }
  await page.click('#ann-preview-copy');
  await sleep(page, 1500);
}

// ────────────────────────────────────────────────────────────────────
// feedback demo flow
// ────────────────────────────────────────────────────────────────────
async function scrollCardIntoView(page, qid) {
  await page.evaluate((id) => {
    const card = document.querySelector('.q-card[data-id="' + id + '"]');
    if (card) card.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, qid);
  await sleep(page, 350);
}

async function cursorToBox(page, box) {
  if (!box) return;
  await moveCursor(page, box.x + box.width / 2, box.y + box.height / 2);
}

async function feedbackFlow(page) {
  // Wait for form to render
  await page.waitForSelector('.q-card[data-id="project_name"]', { timeout: 10000 });
  await sleep(page, 600);

  // 1. project_name (text) — type 'Mailbox'
  await scrollCardIntoView(page, 'project_name');
  {
    const input = page.locator('.q-card[data-id="project_name"] input.q-input');
    const box = await input.boundingBox();
    await cursorToBox(page, box);
    await sleep(page, 200);
    await input.click();
    await page.keyboard.type('Mailbox', { delay: 55 });
    await sleep(page, 500);
  }

  // 2. audience (radio) — pick "Individual power user…"
  await scrollCardIntoView(page, 'audience');
  await sleep(page, 300);
  {
    const opt = page.locator('.q-card[data-id="audience"] .q-option').first();
    const box = await opt.boundingBox();
    await cursorToBox(page, box);
    await sleep(page, 250);
    await opt.click();
    await sleep(page, 600);
  }

  // 3. platforms (checkbox) — pick 3 options
  await scrollCardIntoView(page, 'platforms');
  await sleep(page, 300);
  for (const idx of [0, 1, 4]) { // Web app, macOS, iOS
    const opt = page.locator('.q-card[data-id="platforms"] .q-option').nth(idx);
    const box = await opt.boundingBox();
    await cursorToBox(page, box);
    await sleep(page, 200);
    await opt.click();
    await sleep(page, 350);
  }
  await sleep(page, 300);

  // 4. ai_aggressiveness (scale) — click button "4"
  await scrollCardIntoView(page, 'ai_aggressiveness');
  await sleep(page, 300);
  {
    const btn = page.locator('.q-card[data-id="ai_aggressiveness"] .q-scale-btn').nth(3);
    const box = await btn.boundingBox();
    await cursorToBox(page, box);
    await sleep(page, 250);
    await btn.click();
    await sleep(page, 600);
  }

  // 5. offline_required (boolean) — click "Yes"
  await scrollCardIntoView(page, 'offline_required');
  await sleep(page, 300);
  {
    const yes = page.locator('.q-card[data-id="offline_required"] .q-bool-btn').first();
    const box = await yes.boundingBox();
    await cursorToBox(page, box);
    await sleep(page, 250);
    await yes.click();
    await sleep(page, 600);
  }

  // 6. biggest_worry (textarea)
  await scrollCardIntoView(page, 'biggest_worry');
  await sleep(page, 300);
  {
    const ta = page.locator('.q-card[data-id="biggest_worry"] textarea.q-textarea');
    const box = await ta.boundingBox();
    await cursorToBox(page, box);
    await sleep(page, 200);
    await ta.click();
    await page.keyboard.type('Sync conflicts across devices', { delay: 40 });
    await sleep(page, 600);
  }

  // 7. Click Preview button
  await page.evaluate(() => {
    const b = document.getElementById('preview-btn');
    if (b) b.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await sleep(page, 400);
  {
    const btn = await page.locator('#preview-btn').boundingBox();
    await cursorToBox(page, btn);
    await sleep(page, 300);
    await page.click('#preview-btn');
    await sleep(page, 1200);
  }

  // 8. Show the prompt briefly (scroll textarea)
  await page.evaluate(() => {
    const ta = document.getElementById('preview-textarea');
    if (ta) ta.scrollTop = 0;
  });
  await sleep(page, 900);
  await page.evaluate(() => {
    const ta = document.getElementById('preview-textarea');
    if (ta) ta.scrollTop = 140;
  });
  await sleep(page, 700);

  // 9. Click "Copy to Clipboard"
  {
    const copyBox = await page.locator('#preview-copy').boundingBox();
    await cursorToBox(page, copyBox);
    await sleep(page, 300);
    await page.click('#preview-copy');
    await sleep(page, 1400);
  }
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
