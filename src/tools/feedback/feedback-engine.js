/* ─────────────────────────────────────────────────────────────────────────────
   Feedback engine — renders questions from the QUESTIONS config and collects
   answers. Uses PreviewDialog (shared) for the copy step.
   ───────────────────────────────────────────────────────────────────────────── */

(function () {
  const $ = function (id) { return document.getElementById(id); };

  const emptyState     = $('empty-state');
  const qForm          = $('q-form');
  const successState   = $('success-state');
  const qList          = $('q-list');
  const qTitle         = $('q-title');
  const qDesc          = $('q-description');
  const previewBtn     = $('preview-btn');
  const progressBar    = $('progress-bar');
  const progressLabel  = $('progress-label');
  const answeredCount  = $('answered-count');
  const totalCount     = $('total-count');
  const headerSub      = $('header-sub');

  let config  = null;
  let answers = {};

  function init() {
    if (!QUESTIONS) return;
    try {
      config = typeof QUESTIONS === 'string' ? JSON.parse(QUESTIONS) : QUESTIONS;
      if (!config.questions || !config.questions.length) return;
      buildForm();
    } catch (e) {
      console.error('QUESTIONS parse error:', e);
    }
  }

  function buildForm() {
    emptyState.style.display = 'none';
    qForm.style.display = 'flex';
    progressLabel.style.display = '';
    qTitle.textContent     = config.title || 'Please answer the following';
    qDesc.textContent      = config.description || '';
    qDesc.style.display    = config.description ? '' : 'none';
    headerSub.textContent  = config.title || 'questions loaded';
    totalCount.textContent = config.questions.length;
    qList.innerHTML = '';
    config.questions.forEach(function (q, i) { buildCard(q, i); });
    updateProgress();
    checkSubmit();
  }

  function buildCard(q, idx) {
    const card = document.createElement('div');
    card.className = 'q-card';
    card.dataset.id = q.id;
    const isReq = q.required === true;
    const typeLabel = q.type || 'text';

    card.innerHTML =
      '<div class="q-num">' +
        '<span>Q' + (idx + 1) + '</span>' +
        '<span class="q-tag ' + (isReq ? 'required' : '') + '">' + (isReq ? 'required' : 'optional') + '</span>' +
        '<span class="q-type-tag">' + typeLabel + '</span>' +
        '<span class="q-check">✓</span>' +
      '</div>' +
      '<div class="q-text">' + escapeHtml(q.text) + '</div>' +
      (q.hint ? '<div class="q-hint">' + escapeHtml(q.hint) + '</div>' : '') +
      '<div class="q-input-wrap"></div>' +
      (q.allowImage ? buildImageSection(q.id) : '');

    const wrap = card.querySelector('.q-input-wrap');
    renderInput(q, wrap, card);
    if (q.allowImage) attachImageHandler(card, q.id);

    qList.appendChild(card);
  }

  function buildImageSection(id) {
    return '' +
      '<div class="q-image-section">' +
        '<div class="q-image-label">📎 <span>Attach image</span> (optional)</div>' +
        '<div class="q-image-drop" id="img-drop-' + id + '">' +
          '<input type="file" accept="image/*" id="img-input-' + id + '"/>' +
          '<div class="q-image-drop-text"><b>Click to upload</b> or drag & drop<br/>PNG, JPG, GIF, WebP</div>' +
          '<img class="q-image-preview" id="img-preview-' + id + '" alt="preview"/>' +
        '</div>' +
        '<button class="q-image-clear" id="img-clear-' + id + '" type="button">✕ Remove image</button>' +
      '</div>';
  }

  function attachImageHandler(card, id) {
    const input    = card.querySelector('#img-input-' + id);
    const drop     = card.querySelector('#img-drop-' + id);
    const preview  = card.querySelector('#img-preview-' + id);
    const clearBtn = card.querySelector('#img-clear-' + id);
    const dropText = drop.querySelector('.q-image-drop-text');

    function loadFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        const base64 = ev.target.result;
        preview.src = base64;
        preview.classList.add('visible');
        drop.classList.add('has-image');
        dropText.style.display = 'none';
        clearBtn.classList.add('visible');
        if (!answers[id]) answers[id] = { value: null };
        answers[id].imageBase64 = base64;
        answers[id].imageName   = file.name;
        updateAnswerCard(id, card);
      };
      reader.readAsDataURL(file);
    }

    input.addEventListener('change', function () { loadFile(input.files[0]); });
    drop.addEventListener('dragover',  function (e) { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('dragover'); });
    drop.addEventListener('drop',      function (e) {
      e.preventDefault();
      drop.classList.remove('dragover');
      loadFile(e.dataTransfer.files[0]);
    });
    clearBtn.addEventListener('click', function () {
      input.value = '';
      preview.src = '';
      preview.classList.remove('visible');
      drop.classList.remove('has-image');
      dropText.style.display = '';
      clearBtn.classList.remove('visible');
      if (answers[id]) {
        delete answers[id].imageBase64;
        delete answers[id].imageName;
      }
      updateAnswerCard(id, card);
    });
  }

  function renderInput(q, wrap, card) {
    const id = q.id;

    switch (q.type) {

      case 'textarea': {
        const el = mk('textarea', 'q-textarea', { placeholder: q.placeholder || 'Type your answer…' });
        el.addEventListener('input', function () { setValue(id, el.value.trim(), card); });
        el.addEventListener('focus', function () { card.classList.add('focused'); });
        el.addEventListener('blur',  function () { card.classList.remove('focused'); });
        wrap.appendChild(el);
        break;
      }

      case 'radio':
      case 'checkbox': {
        buildOptions(q, q.type, id, card, wrap);
        break;
      }

      case 'select': {
        const allowOther = q.other !== false; // default ON for radio/checkbox/select
        const sel = mk('select', 'q-select');
        const ph = document.createElement('option');
        ph.value = ''; ph.textContent = 'Choose an option…'; ph.disabled = true; ph.selected = true;
        sel.appendChild(ph);
        (q.options || []).forEach(function (opt) {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt;
          sel.appendChild(o);
        });
        if (allowOther) {
          const o = document.createElement('option');
          o.value = '__other__'; o.textContent = 'Other…';
          sel.appendChild(o);
        }
        const otherInput = allowOther
          ? mk('input', 'q-other-input', { type: 'text', placeholder: 'Please specify…' })
          : null;
        sel.addEventListener('change', function () {
          if (sel.value === '__other__') {
            if (otherInput) {
              otherInput.classList.add('visible');
              otherInput.focus();
            }
            setValue(id, otherInput && otherInput.value.trim() ? 'Other: ' + otherInput.value.trim() : null, card);
          } else {
            if (otherInput) otherInput.classList.remove('visible');
            setValue(id, sel.value, card);
          }
        });
        if (otherInput) {
          otherInput.addEventListener('input', function () {
            const v = otherInput.value.trim();
            setValue(id, v ? 'Other: ' + v : null, card);
          });
        }
        sel.addEventListener('focus', function () { card.classList.add('focused'); });
        sel.addEventListener('blur',  function () { card.classList.remove('focused'); });
        wrap.appendChild(sel);
        if (otherInput) wrap.appendChild(otherInput);
        break;
      }

      case 'scale': {
        const min = q.min != null ? q.min : 1;
        const max = q.max != null ? q.max : 10;
        const btnRow = mk('div', 'q-scale');
        for (let v = min; v <= max; v++) {
          (function (val) {
            const btn = mk('button', 'q-scale-btn');
            btn.type = 'button';
            btn.textContent = val;
            btn.addEventListener('click', function () {
              btnRow.querySelectorAll('.q-scale-btn').forEach(function (b) { b.classList.remove('selected'); });
              btn.classList.add('selected');
              setValue(id, val, card);
            });
            btnRow.appendChild(btn);
          })(v);
        }
        const labels = mk('div', 'q-scale-labels');
        labels.innerHTML = '<span>' + escapeHtml(q.minLabel || String(min)) + '</span><span>' + escapeHtml(q.maxLabel || String(max)) + '</span>';
        wrap.appendChild(btnRow);
        wrap.appendChild(labels);
        break;
      }

      case 'range': {
        const min  = q.min  != null ? q.min  : 0;
        const max  = q.max  != null ? q.max  : 100;
        const step = q.step != null ? q.step : 1;
        const unit = q.unit != null ? q.unit : '';
        const rangeWrap = mk('div', 'q-range-wrap');
        const valRow    = mk('div', 'q-range-value-row');
        const valDisplay= mk('div', 'q-range-value');
        valDisplay.textContent = min;
        const unitLabel = mk('div', 'q-range-unit');
        unitLabel.textContent = unit;
        valRow.appendChild(valDisplay);
        valRow.appendChild(unitLabel);

        const slider = mk('input', 'q-range');
        slider.type = 'range';
        slider.min = min; slider.max = max; slider.step = step;
        slider.value = min;
        slider.addEventListener('input', function () {
          valDisplay.textContent = slider.value;
          setValue(id, Number(slider.value), card);
        });

        const bounds = mk('div', 'q-range-bounds');
        bounds.innerHTML = '<span>' + min + unit + '</span><span>' + max + unit + '</span>';
        rangeWrap.appendChild(valRow);
        rangeWrap.appendChild(slider);
        rangeWrap.appendChild(bounds);
        wrap.appendChild(rangeWrap);

        setValue(id, min, card);
        break;
      }

      case 'boolean': {
        const row = mk('div', 'q-bool');
        ['Yes', 'No'].forEach(function (val) {
          const btn = mk('button', 'q-bool-btn');
          btn.type = 'button';
          btn.textContent = val;
          btn.addEventListener('click', function () {
            row.querySelectorAll('.q-bool-btn').forEach(function (b) { b.className = 'q-bool-btn'; });
            btn.classList.add(val === 'Yes' ? 'selected-yes' : 'selected-no');
            setValue(id, val === 'Yes', card);
          });
          row.appendChild(btn);
        });
        wrap.appendChild(row);
        break;
      }

      case 'date': {
        const el = mk('input', 'q-input');
        el.type = 'date';
        el.addEventListener('change', function () { setValue(id, el.value || null, card); });
        el.addEventListener('focus',  function () { card.classList.add('focused'); });
        el.addEventListener('blur',   function () { card.classList.remove('focused'); });
        wrap.appendChild(el);
        break;
      }

      case 'text':
      default: {
        const el = mk('input', 'q-input', { type: 'text', placeholder: q.placeholder || 'Type your answer…' });
        el.addEventListener('input', function () { setValue(id, el.value.trim(), card); });
        el.addEventListener('focus', function () { card.classList.add('focused'); });
        el.addEventListener('blur',  function () { card.classList.remove('focused'); });
        wrap.appendChild(el);
        break;
      }
    }
  }

  function buildOptions(q, kind, id, card, wrap) {
    const group = mk('div', 'q-options');
    const isCheckbox = kind === 'checkbox';
    const selected = new Set();
    let radioValue = null;
    let otherActive = false;
    let otherText = '';

    const allowOther = q.other !== false; // default ON for radio/checkbox
    const otherInput = allowOther
      ? mk('input', 'q-other-input', { type: 'text', placeholder: 'Please specify…' })
      : null;

    function commitValue() {
      if (isCheckbox) {
        const arr = Array.from(selected);
        if (otherActive && otherText) arr.push('Other: ' + otherText);
        setValue(id, arr.length ? arr : null, card);
      } else {
        if (otherActive) {
          setValue(id, otherText ? 'Other: ' + otherText : null, card);
        } else {
          setValue(id, radioValue, card);
        }
      }
    }

    (q.options || []).forEach(function (opt) {
      const div = mk('div', 'q-option' + (isCheckbox ? ' checkbox' : ''));
      div.innerHTML = '<div class="q-option-mark"></div><span class="q-option-label">' + escapeHtml(opt) + '</span>';
      div.addEventListener('click', function () {
        if (isCheckbox) {
          if (selected.has(opt)) {
            selected.delete(opt);
            div.classList.remove('selected');
          } else {
            selected.add(opt);
            div.classList.add('selected');
          }
        } else {
          group.querySelectorAll('.q-option').forEach(function (el) { el.classList.remove('selected'); });
          div.classList.add('selected');
          radioValue = opt;
          otherActive = false;
          if (otherInput) otherInput.classList.remove('visible');
        }
        commitValue();
      });
      group.appendChild(div);
    });

    if (allowOther) {
      const otherDiv = mk('div', 'q-option' + (isCheckbox ? ' checkbox' : ''));
      otherDiv.innerHTML = '<div class="q-option-mark"></div><span class="q-option-label">Other…</span>';
      otherDiv.addEventListener('click', function () {
        if (isCheckbox) {
          otherActive = !otherActive;
          otherDiv.classList.toggle('selected', otherActive);
          if (otherActive) {
            otherInput.classList.add('visible');
            setTimeout(function () { otherInput.focus(); }, 50);
          } else {
            otherInput.classList.remove('visible');
            otherText = '';
            otherInput.value = '';
          }
        } else {
          group.querySelectorAll('.q-option').forEach(function (el) { el.classList.remove('selected'); });
          otherDiv.classList.add('selected');
          radioValue = null;
          otherActive = true;
          otherInput.classList.add('visible');
          setTimeout(function () { otherInput.focus(); }, 50);
        }
        commitValue();
      });
      group.appendChild(otherDiv);

      otherInput.addEventListener('input', function () {
        otherText = otherInput.value.trim();
        commitValue();
      });
    }

    wrap.appendChild(group);
    if (otherInput) wrap.appendChild(otherInput);
  }

  function setValue(id, val, card) {
    if (!answers[id]) answers[id] = {};
    answers[id].value = val;
    updateAnswerCard(id, card);
  }

  function isAnswered(a) {
    if (!a) return false;
    if (a.imageBase64) return true;
    const v = a.value;
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }

  function updateAnswerCard(id, card) {
    card.classList.toggle('answered', isAnswered(answers[id]));
    updateProgress();
    checkSubmit();
  }

  function updateProgress() {
    const total = (config && config.questions) ? config.questions.length : 0;
    const done  = Object.keys(answers).filter(function (id) { return isAnswered(answers[id]); }).length;
    progressBar.style.width = total ? (done / total) * 100 + '%' : '0%';
    answeredCount.textContent = done;
  }

  function checkSubmit() {
    const required = (config && config.questions || []).filter(function (q) { return q.required; });
    const allDone  = required.every(function (q) { return isAnswered(answers[q.id]); });
    previewBtn.disabled = !allDone;
    const remaining = required.filter(function (q) { return !isAnswered(answers[q.id]); }).length;
    $('req-note').innerHTML = remaining > 0
      ? '<b>' + remaining + '</b> required ' + (remaining === 1 ? 'question' : 'questions') + ' remaining'
      : '<span style="color:var(--green);">✓ All required questions answered</span>';
  }

  function buildPayload() {
    const payload = {
      _type: 'human_feedback_response',
      title: config && config.title || null,
      answered_at: new Date().toISOString(),
      answers: {}
    };
    (config && config.questions || []).forEach(function (q) {
      const a = answers[q.id] || {};
      const entry = {
        question: q.text,
        type: q.type || 'text',
        answer: a.value !== undefined ? a.value : null
      };
      if (a.imageBase64) {
        entry.image = { name: a.imageName || 'image', data: a.imageBase64 };
      }
      payload.answers[q.id] = entry;
    });
    return payload;
  }

  function showSuccess() {
    qForm.style.display = 'none';
    successState.style.display = 'flex';
    progressBar.style.width = '100%';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildPromptString() {
    const cfg = config || { questions: [] };
    return buildAgentPrompt({
      tool: 'feedback',
      source: cfg.title || 'questionnaire',
      items: (cfg.questions || []).map(function (q) {
        const a = answers[q.id] || {};
        const v = a.value;
        let answerText;
        if (v == null || v === '') {
          answerText = '(no answer)';
        } else if (Array.isArray(v)) {
          answerText = v.length ? v.join(', ') : '(no answer)';
        } else if (typeof v === 'boolean') {
          answerText = v ? 'Yes' : 'No';
        } else {
          answerText = String(v);
        }
        if (a.imageBase64) answerText += ' [image attached: ' + (a.imageName || 'image') + ']';
        return {
          heading: q.text,
          typeLabel: q.type || 'text',
          comment: answerText
        };
      })
    });
  }

  previewBtn.addEventListener('click', function () {
    PreviewDialog.open({
      payload: buildPromptString(),
      onCopySuccess: showSuccess
    });
  });

  $('copy-again-btn').addEventListener('click', function () {
    PreviewDialog.open({
      payload: buildPromptString(),
      onCopySuccess: showSuccess
    });
  });

  $('edit-again-btn').addEventListener('click', function () {
    successState.style.display = 'none';
    qForm.style.display = 'flex';
  });

  function mk(tag, cls, attrs) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { el[k] = attrs[k]; });
    return el;
  }

  init();
})();
