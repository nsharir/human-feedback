'use strict';

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Compile a test feedback page
const { compile } = require('../lib/compiler');
const inputJson = path.join(__dirname, 'fixture.json');
const outputHtml = path.join(__dirname, 'out.html');

// Write a test fixture
fs.writeFileSync(inputJson, JSON.stringify({
  title: "Test",
  questions: [
    { id: "checks", text: "Pick multiple", type: "checkbox", options: ["A", "B", "C"], other: true, required: true },
    { id: "radio", text: "Pick one",     type: "radio",    options: ["X", "Y"],         other: true, required: true }
  ]
}, null, 2));

if (fs.existsSync(outputHtml)) fs.unlinkSync(outputHtml);
compile(inputJson, outputHtml);

const html = fs.readFileSync(outputHtml, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously' });
const doc = dom.window.document;

// Wait for the engine to build
function ready() {
  return new Promise(r => setTimeout(r, 100));
}

function assert(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else {
    console.error('  ✗', msg);
    process.exitCode = 1;
  }
}

(async () => {
  await ready();

  console.log('\n=== Smoke tests for feedback template ===\n');

  // 1. Form rendered
  const cards = doc.querySelectorAll('.q-card');
  assert(cards.length === 2, `2 cards rendered (got ${cards.length})`);

  // 2. Checkbox question: multiple options + Other
  const checksCard = doc.querySelector('[data-id="checks"]');
  const checkOptions = checksCard.querySelectorAll('.q-option');
  assert(checkOptions.length === 4, `Checkbox has 3 options + Other (got ${checkOptions.length})`);

  // 3. Click option A
  checkOptions[0].click();
  await ready();
  assert(checkOptions[0].classList.contains('selected'), 'Option A becomes selected');

  // 4. Click option B - should still have A selected
  checkOptions[1].click();
  await ready();
  assert(checkOptions[0].classList.contains('selected'), 'Option A still selected after clicking B');
  assert(checkOptions[1].classList.contains('selected'), 'Option B selected');

  // 5. Click option A again - should deselect
  checkOptions[0].click();
  await ready();
  assert(!checkOptions[0].classList.contains('selected'), 'Option A deselected on second click');
  assert(checkOptions[1].classList.contains('selected'), 'Option B still selected');

  // 6. Check Other field appears
  const otherOption = checkOptions[3];
  otherOption.click();
  await ready();
  assert(otherOption.classList.contains('selected'), 'Other option selected');
  const otherInput = checksCard.querySelector('.q-other-input');
  assert(otherInput && otherInput.classList.contains('visible'), 'Other input visible');

  // 7. Radio question - single select
  const radioCard = doc.querySelector('[data-id="radio"]');
  const radioOpts = radioCard.querySelectorAll('.q-option');
  radioOpts[0].click();
  await ready();
  assert(radioOpts[0].classList.contains('selected'), 'Radio X selected');
  radioOpts[1].click();
  await ready();
  assert(!radioOpts[0].classList.contains('selected'), 'Radio X deselected when Y clicked');
  assert(radioOpts[1].classList.contains('selected'), 'Radio Y selected');

  // 8. Preview button enabled
  const previewBtn = doc.getElementById('preview-btn');
  assert(!previewBtn.disabled, 'Preview button enabled when all required answered');

  // 9. Open preview dialog
  previewBtn.click();
  await ready();
  const overlay = doc.getElementById('preview-overlay');
  assert(overlay.classList.contains('open'), 'Preview dialog opened');

  // 10. Textarea contains expected JSON
  const textarea = doc.getElementById('preview-textarea');
  const payload = JSON.parse(textarea.value);
  assert(payload._type === 'agent_feedback_response', 'Payload _type correct');
  assert(payload.answers.radio.answer === 'Y', `Radio answer correct (got ${payload.answers.radio.answer})`);
  assert(Array.isArray(payload.answers.checks.answer), 'Checks answer is array');
  assert(payload.answers.checks.answer.includes('B'), `Checks contains B`);

  // 11. Textarea is editable
  const newText = 'edited test';
  textarea.value = newText;
  textarea.dispatchEvent(new dom.window.Event('input'));
  await ready();
  assert(textarea.value === newText, 'Textarea is editable');

  // 12. Reset restores pristine
  doc.getElementById('preview-reset').click();
  await ready();
  assert(textarea.value !== newText, 'Reset restored pristine prompt');
  assert(textarea.value.includes('agent_feedback_response'), 'Reset value contains payload');

  // Cleanup
  fs.unlinkSync(inputJson);
  fs.unlinkSync(outputHtml);

  console.log('\n=== Tests complete ===\n');
})();
