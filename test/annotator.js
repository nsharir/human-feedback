/**
 * Smoke tests for the HTML annotator template.
 * Loads a compiled example HTML in jsdom and verifies the annotator UI mounts,
 * an element click opens the comment dialog, and saving an annotation produces
 * a copy-prompt payload.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); passed++; }
  else      { console.log('  ✗ ' + msg); failed++; }
}

console.log('\n=== Smoke tests for HTML annotator ===\n');

// Make sure the compiled example exists
const compiledPath = path.join(__dirname, '..', 'examples', 'built', 'landing-page.annotated.html');
if (!fs.existsSync(compiledPath)) {
  // Compile on the fly if compile:examples wasn't run
  require('child_process').execSync('node scripts/compile-examples.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
  });
}

const html = fs.readFileSync(compiledPath, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const document = window.document;

// Wait a tick for the IIFE to run
setTimeout(() => {
  try {
    assert(window.__annotatorLoaded === true, 'annotator IIFE flagged as loaded');
    assert(!!document.getElementById('ann-toolbar'),     'toolbar mounted');
    assert(!!document.getElementById('ann-fab'),         'mobile FAB mounted');
    assert(!!document.getElementById('ann-panel'),       'side panel mounted');
    assert(!!document.getElementById('ann-dialog'),      'comment dialog mounted');
    assert(!!document.getElementById('ann-copy-btn'),    'copy-prompt button present');
    assert(!!document.getElementById('ann-clear-btn'),   'clear button present');
    assert(!!document.getElementById('ann-preview-overlay'), 'preview overlay present');

    // Simulate clicking a target element on the page
    const target = document.querySelector('h1');
    assert(!!target, 'page has an <h1> element to click');

    const clickEvt = new window.MouseEvent('click', {
      bubbles: true, cancelable: true, clientX: 100, clientY: 100,
    });
    target.dispatchEvent(clickEvt);

    const dialog = document.getElementById('ann-dialog');
    assert(dialog.style.display === 'block', 'clicking element opens comment dialog');
    assert(/h1|Acme/i.test(document.getElementById('ann-dialog-preview').textContent),
           'dialog shows preview of target element');

    // Type a comment + save
    const input = document.getElementById('ann-dialog-input');
    input.value = 'This headline is too generic';
    document.getElementById('ann-dialog-save').click();

    assert(dialog.style.display === 'none', 'dialog closes after saving');
    assert(target.classList.contains('ann-highlighted'), 'target gets highlighted outline');
    assert(target.querySelector('.ann-pin'), 'target gets floating ID pin');
    assert(document.getElementById('ann-count').textContent.includes('1'),
           'annotation counter increments');

    // Open preview & inspect the generated prompt
    document.getElementById('ann-copy-btn').click();
    assert(document.getElementById('ann-preview-overlay').classList.contains('open'),
           'copy-prompt opens preview dialog');
    const promptText = document.getElementById('ann-preview-textarea').value;
    assert(promptText.includes('Annotation #1'),       'prompt lists annotation #1');
    assert(promptText.includes('too generic'),         'prompt includes comment text');
    assert(promptText.includes('CSS Selector:'),       'prompt includes CSS selector');

    // Panel listing
    document.getElementById('ann-panel-btn').click();
    assert(document.getElementById('ann-panel').classList.contains('open'),
           'review panel opens');
    assert(document.getElementById('ann-panel-list').querySelectorAll('.ann-card').length === 1,
           'one annotation card rendered in panel');

    console.log('\n=== ' + passed + ' passed, ' + failed + ' failed ===\n');
    if (failed > 0) process.exit(1);
  } catch (e) {
    console.error('Test crashed:', e);
    process.exit(1);
  }
}, 100);
