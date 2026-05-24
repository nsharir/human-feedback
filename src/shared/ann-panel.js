/* ─────────────────────────────────────────────────────────────────────────────
   Shared annotation panel + FAB (UI only).

   Exposes a single global: window.AnnPanel
   API:
     AnnPanel.mount(opts) → { refresh, open, close, isOpen, destroy, els }
       opts: {
         accent:           '#4f46e5',            // optional accent override (CSS var on host)
         title:            'Annotations',         // panel header title
         showFab:          true,                  // render the floating button
         fabIcon:          '💬',                  // FAB content
         showJsonButton:   true,                  // show Copy JSON button
         confirmDelete:    'Delete this annotation? This cannot be undone.',
         confirmClear:     null,                  // string or function(count) => string
         emptyText:        'No annotations yet.<br/>Highlight text or click an element to start.',
         onCopyPrompt:     () => void,
         onCopyJson:       () => void,
         onClearAll:       () => void,
         onItemClick:      (id) => void,
         onItemDelete:     (id) => void,
         getItems:         () => [{ id, badge, snippet, comment, lineRef, typeLabel }],
       }
       Each item:
         id        — opaque identifier (string|number)
         badge     — short text shown in the colored badge (e.g. "A1", "#3")
         typeLabel — small grey label (e.g. "text selection")
         lineRef   — optional small green pill (e.g. "L12")
         snippet   — source/code snippet, monospace background bar
         comment   — main comment text
   ───────────────────────────────────────────────────────────────────────────── */
(function (root) {
  if (root.AnnPanel) return;

  // Self-inject CSS only if it hasn't been included via <style>/<link>
  function injectCss() {
    if (document.getElementById('ann-panel-shared-css')) return;
    // If the page already defines #ann-panel rules via a stylesheet (e.g. inlined
    // by the build), we still inject — duplicate rules are harmless and ensure
    // the JS-only consumer (html-annotator) gets styled.
    var css = root.__ANN_PANEL_CSS__;
    if (!css) return; // host didn't supply CSS (it's in a <style> block instead)
    var s = document.createElement('style');
    s.id = 'ann-panel-shared-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'style') e.style.cssText = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (html != null) e.innerHTML = html;
    return e;
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mount(opts) {
    opts = opts || {};
    injectCss();
    var showFab        = opts.showFab !== false;
    var fabIcon        = opts.fabIcon || '💬';
    var title          = opts.title  || 'Annotations';
    // showJsonButton is deprecated — JSON output has been removed. The option
    // is accepted for backwards compatibility but ignored.
    var showJsonButton = false;
    var emptyText      = opts.emptyText || 'No annotations yet.<br/>Highlight text or click an element to start.';
    var confirmDelete  = opts.confirmDelete || 'Delete this annotation? This cannot be undone.';
    var confirmClear   = opts.confirmClear;

    // Don't mount twice
    if (document.getElementById('ann-panel')) {
      return _existingHandle();
    }

    // Build panel
    var panel = el('div', { id: 'ann-panel', class: 'ann-panel', role: 'complementary' });
    if (opts.accent) panel.style.setProperty('--ann-accent', opts.accent);

    var header = el('div', { id: 'ann-panel-header' });
    var h3 = el('h3', null,
      escHtml(title) + ' <span id="ann-panel-count">(0)</span>');
    var closeBtn = el('button', { id: 'ann-panel-close', type: 'button', 'aria-label': 'Close panel' }, '✕');
    header.appendChild(h3);
    header.appendChild(closeBtn);

    var list = el('div', { id: 'ann-panel-list' });

    var footer = el('div', { id: 'ann-panel-footer' });
    var copyPrompt = el('button',
      { id: 'ann-copy-prompt', class: 'ann-panel-btn primary', type: 'button' },
      '⎘ Copy Prompt');
    footer.appendChild(copyPrompt);

    var copyJson = null;
    if (showJsonButton) {
      var row = el('div', { class: 'ann-panel-row' });
      copyJson = el('button',
        { id: 'ann-copy-json', class: 'ann-panel-btn', type: 'button' },
        '{ } Copy JSON');
      row.appendChild(copyJson);
      footer.appendChild(row);
    }

    var clearBtn = el('button',
      { id: 'ann-clear', class: 'ann-panel-btn danger', type: 'button' },
      '⊘ Clear All');
    footer.appendChild(clearBtn);

    panel.appendChild(header);
    panel.appendChild(list);
    panel.appendChild(footer);
    document.body.appendChild(panel);

    // FAB
    var fab = null, fabBadge = null;
    if (showFab) {
      fab = el('button',
        { id: 'ann-shared-fab', type: 'button', 'aria-label': 'View annotations', title: 'View annotations' });
      fab.innerHTML = escHtml(fabIcon) + '<span id="ann-shared-fab-badge">0</span>';
      if (opts.accent) fab.style.setProperty('--ann-accent', opts.accent);
      document.body.appendChild(fab);
      fabBadge = fab.querySelector('#ann-shared-fab-badge');
      fab.addEventListener('click', function () {
        if (panel.classList.contains('open')) close();
        else open();
      });
    }

    // ── handlers ────────────────────────────────────────────────────────
    function open()  { panel.classList.add('open'); }
    function close() { panel.classList.remove('open'); }
    function isOpen() { return panel.classList.contains('open'); }

    closeBtn.addEventListener('click', close);

    copyPrompt.addEventListener('click', function () {
      if (typeof opts.onCopyPrompt === 'function') opts.onCopyPrompt();
    });
    if (copyJson) copyJson.addEventListener('click', function () {
      if (typeof opts.onCopyJson === 'function') opts.onCopyJson();
    });
    clearBtn.addEventListener('click', function () {
      var items = (typeof opts.getItems === 'function') ? opts.getItems() : [];
      if (!items.length) return;
      var msg = typeof confirmClear === 'function'
        ? confirmClear(items.length)
        : (confirmClear || ('Clear all ' + items.length + ' annotations?'));
      if (!window.confirm(msg)) return;
      if (typeof opts.onClearAll === 'function') opts.onClearAll();
      refresh();
    });

    function refresh() {
      var items = (typeof opts.getItems === 'function') ? opts.getItems() : [];
      var n = items.length;
      var countEl = document.getElementById('ann-panel-count');
      if (countEl) countEl.textContent = '(' + n + ')';
      if (fabBadge) {
        fabBadge.textContent = n;
        fabBadge.classList.toggle('on', n > 0);
      }
      if (!n) {
        list.innerHTML =
          '<div id="ann-panel-empty">' +
            '<div class="ann-empty-icon">💬</div>' +
            emptyText +
          '</div>';
        return;
      }
      var html = '';
      for (var i = 0; i < items.length; i++) {
        var it   = items[i];
        var bid  = escHtml(it.id);
        var bdg  = escHtml(it.badge   != null ? it.badge   : ('#' + it.id));
        var tlbl = escHtml(it.typeLabel || '');
        var line = it.lineRef ? '<div class="ann-card-line">' + escHtml(it.lineRef) + '</div>' : '';
        var src  = it.snippet ? '<div class="ann-card-src">' + escHtml(it.snippet) + '</div>' : '';
        var cmt  = escHtml(it.comment || '');
        html +=
          '<div class="ann-card" data-id="' + bid + '">' +
            '<div class="ann-card-top">' +
              '<div class="ann-card-badge">' + bdg + '</div>' +
              '<div class="ann-card-id">' + tlbl + '</div>' +
              line +
              '<button class="ann-card-del" data-del="' + bid + '" type="button" aria-label="Delete annotation">✕</button>' +
            '</div>' +
            src +
            '<div class="ann-card-comment">' + cmt + '</div>' +
          '</div>';
      }
      list.innerHTML = html;

      // Wire per-card events
      var dels = list.querySelectorAll('[data-del]');
      for (var d = 0; d < dels.length; d++) {
        (function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!window.confirm(confirmDelete)) return;
            var raw = btn.getAttribute('data-del');
            var idVal = (/^-?\d+$/).test(raw) ? parseInt(raw, 10) : raw;
            if (typeof opts.onItemDelete === 'function') opts.onItemDelete(idVal);
            refresh();
          });
        }(dels[d]));
      }
      var cards = list.querySelectorAll('.ann-card');
      for (var c = 0; c < cards.length; c++) {
        (function (card) {
          card.addEventListener('click', function () {
            var raw = card.getAttribute('data-id');
            var idVal = (/^-?\d+$/).test(raw) ? parseInt(raw, 10) : raw;
            if (typeof opts.onItemClick === 'function') opts.onItemClick(idVal);
          });
        }(cards[c]));
      }
    }

    function focusItem(id) {
      open();
      var card = list.querySelector('.ann-card[data-id="' + String(id).replace(/"/g, '\\"') + '"]');
      if (!card) return;
      var existing = list.querySelectorAll('.ann-card.ann-card-active');
      for (var i = 0; i < existing.length; i++) existing[i].classList.remove('ann-card-active');
      card.classList.add('ann-card-active');
      try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      setTimeout(function () { card.classList.remove('ann-card-active'); }, 1500);
    }

    function destroy() {
      panel.remove();
      if (fab) fab.remove();
    }

    function setFabHidden(hidden) {
      if (fab) fab.classList.toggle('ann-hidden', !!hidden);
    }

    refresh();

    function _existingHandle() {
      return {
        refresh: refresh,
        open: open, close: close, isOpen: isOpen,
        focusItem: focusItem,
        setFabHidden: setFabHidden,
        destroy: destroy,
        els: { panel: panel, list: list, fab: fab, copyPrompt: copyPrompt, copyJson: copyJson, clearBtn: clearBtn },
      };
    }

    return _existingHandle();
  }

  root.AnnPanel = { mount: mount };
}(typeof window !== 'undefined' ? window : this));
