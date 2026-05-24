/**
 * annotator.js — v2 (mobile-first)
 * ─────────────────────────────────
 * Desktop: hover to preview, click to annotate element, mouseup on selection for text
 * Mobile:  long-press (600ms) to annotate element, native text-selection + toolbar tap for text
 * FAB bottom-right opens annotation menu on mobile.
 *
 * Usage: <script src="annotator.js"></script>
 */

(function () {
  if (window.__annotatorLoaded) return;
  window.__annotatorLoaded = true;

  // ─── State ────────────────────────────────────────────────────────────────
  const annotations = [];
  let idCounter = 0;
  let annotationMode = true;
  let pendingAnnotation = null;

  const isMobile = () => window.matchMedia('(pointer: coarse)').matches;

  const COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#C77DFF','#FF9A3C'];
  let colorIndex = 0;
  const nextColor = () => COLORS[colorIndex++ % COLORS.length];

  // ─── Styles ───────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --ann-bg: #0f0f13;
      --ann-surface: #1a1a24;
      --ann-border: #2e2e40;
      --ann-accent: #7c6fff;
      --ann-text: #e8e8f0;
      --ann-muted: #666680;
      --ann-radius: 12px;
      --ann-font: 'DM Mono', 'Fira Code', monospace;
    }

    /* ── FAB (mobile) ── */
    #ann-fab {
      position: fixed;
      bottom: 28px;
      right: 20px;
      z-index: 999999;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--ann-accent);
      border: none;
      color: #fff;
      font-size: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 24px rgba(124,111,255,0.5);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    #ann-fab:active { transform: scale(0.92); }
    #ann-fab.mode-off { background: var(--ann-surface); border: 1px solid var(--ann-border); }
    #ann-fab .ann-fab-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #FF6B6B;
      color: #fff;
      font-size: 9px;
      font-family: var(--ann-font);
      font-weight: bold;
      border-radius: 10px;
      padding: 2px 5px;
      min-width: 16px;
      text-align: center;
      display: none;
    }
    #ann-fab .ann-fab-badge.visible { display: block; }

    /* ── FAB Menu ── */
    #ann-fab-menu {
      position: fixed;
      bottom: 96px;
      right: 20px;
      z-index: 999998;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-end;
      pointer-events: none;
      opacity: 0;
      transform: translateY(12px);
      transition: opacity 0.2s, transform 0.2s;
    }
    #ann-fab-menu.open {
      pointer-events: all;
      opacity: 1;
      transform: translateY(0);
    }
    .ann-fab-action {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ann-fab-action-label {
      background: var(--ann-bg);
      border: 1px solid var(--ann-border);
      border-radius: 8px;
      padding: 6px 12px;
      font-family: var(--ann-font);
      font-size: 12px;
      color: var(--ann-text);
      white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .ann-fab-action-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid var(--ann-border);
      background: var(--ann-surface);
      color: var(--ann-text);
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      flex-shrink: 0;
    }

    /* ── Desktop toolbar ── */
    #ann-toolbar {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      background: var(--ann-bg);
      border: 1px solid var(--ann-border);
      border-radius: 50px;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,111,255,0.12);
      font-family: var(--ann-font);
      font-size: 12px;
      color: var(--ann-text);
    }
    #ann-toolbar .ann-sep { width:1px; height:20px; background:var(--ann-border); }
    .ann-btn {
      background: none;
      border: 1px solid var(--ann-border);
      border-radius: 6px;
      color: var(--ann-text);
      cursor: pointer;
      padding: 6px 12px;
      font-family: var(--ann-font);
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
      white-space: nowrap;
      -webkit-tap-highlight-color: transparent;
    }
    .ann-btn:hover { background:var(--ann-surface); border-color:var(--ann-accent); }
    .ann-btn.active { background:var(--ann-accent); border-color:var(--ann-accent); color:#fff; }
    .ann-btn.danger { border-color:#FF6B6B33; color:#FF6B6B; }
    .ann-btn.primary { border-color:var(--ann-accent); color:var(--ann-accent); }
    .ann-btn.primary:hover { background:var(--ann-accent); color:#fff; }
    #ann-count {
      background: var(--ann-surface);
      border: 1px solid var(--ann-border);
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 11px;
      color: var(--ann-muted);
    }
    #ann-count span { color:var(--ann-accent); font-weight:bold; }

    /* ── Long-press ring (mobile) ── */
    #ann-longpress-ring {
      position: fixed;
      pointer-events: none;
      border-radius: 50%;
      z-index: 9999998;
      width: 48px;
      height: 48px;
      margin-left: -24px;
      margin-top: -24px;
      border: 2px solid var(--ann-accent);
      opacity: 0;
      transform: scale(0.5);
      transition: none;
    }
    #ann-longpress-ring.charging {
      transition: transform 0.6s ease-out, opacity 0.1s;
      transform: scale(1);
      opacity: 1;
    }
    #ann-longpress-ring.fired {
      transition: transform 0.15s, opacity 0.15s;
      transform: scale(1.4);
      opacity: 0;
    }

    /* ── Element highlights ── */
    .ann-hover-target {
      outline: 2px dashed rgba(124,111,255,0.6) !important;
      outline-offset: 2px !important;
      cursor: crosshair !important;
    }
    .ann-longpress-target {
      outline: 2px solid var(--ann-accent) !important;
      outline-offset: 2px !important;
      background-color: rgba(124,111,255,0.06) !important;
    }
    .ann-highlighted {
      outline: 2px solid var(--annotation-color, #7c6fff) !important;
      outline-offset: 2px !important;
      position: relative !important;
    }
    .ann-text-mark {
      background: color-mix(in srgb, var(--annotation-color, #FFD93D) 35%, transparent);
      border-radius: 2px;
      cursor: pointer;
    }
    .ann-pin {
      position: absolute;
      top: -10px; left: -10px;
      width: 22px; height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: bold;
      color: #fff;
      font-family: var(--ann-font);
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      cursor: pointer;
      z-index: 99999;
      border: 1.5px solid rgba(255,255,255,0.25);
      transition: transform 0.15s;
    }
    .ann-pin:active { transform: scale(1.2); }

    /* ── Text selection action bar (mobile) ── */
    #ann-sel-bar {
      position: fixed;
      z-index: 9999999;
      background: var(--ann-bg);
      border: 1px solid var(--ann-accent);
      border-radius: 8px;
      padding: 8px 14px;
      font-family: var(--ann-font);
      font-size: 13px;
      color: var(--ann-accent);
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      cursor: pointer;
      display: none;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    #ann-sel-bar.visible { display: flex; }

    /* ── Comment sheet (bottom sheet on mobile, dialog on desktop) ── */
    #ann-dialog {
      position: fixed;
      z-index: 9999999;
      background: var(--ann-bg);
      border: 1px solid var(--ann-border);
      font-family: var(--ann-font);
    }
    /* Desktop */
    @media (pointer: fine) {
      #ann-dialog {
        border-radius: var(--ann-radius);
        padding: 16px;
        width: 300px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.7);
      }
    }
    /* Mobile */
    @media (pointer: coarse) {
      #ann-dialog {
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        top: auto !important;
        width: 100% !important;
        border-radius: 16px 16px 0 0;
        padding: 20px 20px 32px;
        box-shadow: 0 -8px 40px rgba(0,0,0,0.7);
        border-bottom: none;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
      }
      #ann-dialog.sheet-open {
        transform: translateY(0);
      }
      #ann-dialog .ann-sheet-handle {
        width: 36px; height: 4px;
        background: var(--ann-border);
        border-radius: 2px;
        margin: 0 auto 16px;
      }
      #ann-dialog textarea {
        font-size: 16px !important; /* prevent iOS zoom */
      }
      #ann-dialog .ann-dialog-actions .ann-btn {
        flex: 1;
        justify-content: center;
        padding: 12px !important;
        font-size: 13px !important;
      }
    }
    #ann-dialog h4 {
      margin: 0 0 10px;
      font-size: 11px;
      color: var(--ann-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    #ann-dialog .ann-context-preview {
      background: var(--ann-surface);
      border: 1px solid var(--ann-border);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 11px;
      color: var(--ann-muted);
      margin-bottom: 10px;
      max-height: 60px;
      overflow: hidden;
      line-height: 1.5;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    #ann-dialog textarea {
      width: 100%;
      min-height: 80px;
      background: var(--ann-surface);
      border: 1px solid var(--ann-border);
      border-radius: 6px;
      color: var(--ann-text);
      font-family: var(--ann-font);
      font-size: 12px;
      padding: 8px 10px;
      resize: vertical;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.15s;
    }
    #ann-dialog textarea:focus { border-color: var(--ann-accent); }
    #ann-dialog .ann-dialog-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      justify-content: flex-end;
    }

    /* ── Side panel ── */
    #ann-panel {
      position: fixed;
      z-index: 999997;
      background: var(--ann-bg);
      display: flex;
      flex-direction: column;
      font-family: var(--ann-font);
      transition: transform 0.28s cubic-bezier(0.16,1,0.3,1);
    }
    @media (pointer: fine) {
      #ann-panel {
        top: 0; right: 0;
        height: 100%; width: 360px;
        border-left: 1px solid var(--ann-border);
        transform: translateX(100%);
      }
      #ann-panel.open { transform: translateX(0); }
    }
    @media (pointer: coarse) {
      #ann-panel {
        bottom: 0; left: 0; right: 0;
        height: 75vh;
        border-top: 1px solid var(--ann-border);
        border-radius: 16px 16px 0 0;
        transform: translateY(100%);
      }
      #ann-panel.open { transform: translateY(0); }
    }
    #ann-panel-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--ann-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #ann-panel-header h3 { margin:0; font-size:13px; color:var(--ann-text); }
    #ann-panel-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      -webkit-overflow-scrolling: touch;
    }
    .ann-card {
      background: var(--ann-surface);
      border: 1px solid var(--ann-border);
      border-radius: 8px;
      padding: 12px;
    }
    .ann-card-header { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
    .ann-card-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .ann-card-meta { font-size:10px; color:var(--ann-muted); flex:1; }
    .ann-card-del {
      background: none; border: none; cursor: pointer;
      color: var(--ann-muted); font-size:18px; line-height:1;
      padding: 4px 6px; transition: color 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .ann-card-del:active { color: #FF6B6B; }
    .ann-card-context { font-size:10px; color:var(--ann-muted); background:var(--ann-bg); border-radius:4px; padding:4px 8px; margin-bottom:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ann-card-comment { font-size:12px; color:var(--ann-text); line-height:1.5; }
    #ann-panel-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--ann-border);
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-bottom: env(safe-area-inset-bottom, 12px);
    }

    /* ── Toast ── */
    #ann-toast {
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #6BCB77;
      color: #000;
      padding: 9px 20px;
      border-radius: 20px;
      font-family: var(--ann-font);
      font-size: 12px;
      font-weight: bold;
      opacity: 0;
      transition: all 0.25s;
      z-index: 99999999;
      pointer-events: none;
      white-space: nowrap;
    }
    #ann-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }

    /* ── Overlay for sheet backdrop ── */
    #ann-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 999996;
      display: none;
      -webkit-tap-highlight-color: transparent;
    }
    #ann-overlay.visible { display: block; }

    /* ── PREVIEW DIALOG (consistent with other tools) ── */
    #ann-preview-overlay {
      position: fixed; inset: 0;
      background: rgba(15,15,19,0.55);
      z-index: 9999999;
      display: none;
      align-items: center; justify-content: center;
      padding: 24px;
      backdrop-filter: blur(4px);
    }
    #ann-preview-overlay.open { display: flex; }
    #ann-preview-dialog {
      background: #1a1a24;
      border: 1px solid #2e2e40;
      border-radius: 12px;
      width: 100%;
      max-width: 720px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      overflow: hidden;
      font-family: var(--ann-font);
    }
    .ann-preview-header {
      padding: 16px 22px;
      border-bottom: 1px solid #2e2e40;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
    }
    .ann-preview-header h3 {
      font-size: 14px;
      color: #e8e8f0;
      margin: 0 0 4px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .ann-preview-header p {
      font-size: 11px;
      color: #666680;
      margin: 0;
      line-height: 1.5;
    }
    .ann-preview-close {
      background: none;
      border: none;
      font-size: 18px;
      color: #666680;
      cursor: pointer;
      width: 28px; height: 28px;
      border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
    }
    .ann-preview-close:hover { background: #0f0f13; color: #e8e8f0; }
    #ann-preview-textarea {
      flex: 1;
      width: 100%;
      border: none;
      outline: none;
      padding: 18px 22px;
      font-family: var(--ann-font);
      font-size: 12px;
      color: #e8e8f0;
      background: #0f0f13;
      resize: none;
      line-height: 1.65;
      min-height: 320px;
    }
    @media (pointer: coarse) {
      #ann-preview-textarea { font-size: 14px; }
    }
    .ann-preview-footer {
      padding: 12px 22px;
      border-top: 1px solid #2e2e40;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background: #1a1a24;
      flex-wrap: wrap;
    }
    .ann-preview-info {
      font-size: 10px;
      color: #666680;
    }
    .ann-preview-actions { display: flex; gap: 8px; }
    .ann-preview-btn {
      font-family: var(--ann-font);
      font-size: 11px;
      padding: 8px 16px;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.15s;
      -webkit-tap-highlight-color: transparent;
      border: 1px solid #2e2e40;
      background: none;
      color: #e8e8f0;
    }
    .ann-preview-btn:hover { border-color: #7c6fff; }
    .ann-preview-btn.primary {
      background: #7c6fff; border-color: #7c6fff; color: #fff;
    }
    .ann-preview-btn.primary:hover { background: #6b5fef; }
  `;
  document.head.appendChild(style);

  // ─── DOM ──────────────────────────────────────────────────────────────────

  // Desktop toolbar
  const toolbar = document.createElement('div');
  toolbar.id = 'ann-toolbar';
  toolbar.innerHTML = `
    <span style="color:#7c6fff;font-weight:bold;letter-spacing:0.05em;">◈ ANNOTATE</span>
    <div class="ann-sep"></div>
    <button class="ann-btn active" id="ann-toggle-btn">● Mode On</button>
    <div id="ann-count">annotations: <span>0</span></div>
    <div class="ann-sep"></div>
    <button class="ann-btn" id="ann-panel-btn">☰ Review</button>
    <button class="ann-btn primary" id="ann-copy-btn">⎘ Copy Prompt</button>
  `;
  document.body.appendChild(toolbar);

  // FAB (mobile)
  const fab = document.createElement('button');
  fab.id = 'ann-fab';
  fab.innerHTML = `✏️<span class="ann-fab-badge" id="ann-fab-badge">0</span>`;
  document.body.appendChild(fab);

  const fabMenu = document.createElement('div');
  fabMenu.id = 'ann-fab-menu';
  fabMenu.innerHTML = `
    <div class="ann-fab-action" id="ann-fab-copy">
      <span class="ann-fab-action-label">Copy Prompt</span>
      <button class="ann-fab-action-btn">⎘</button>
    </div>
    <div class="ann-fab-action" id="ann-fab-review">
      <span class="ann-fab-action-label">Review Annotations</span>
      <button class="ann-fab-action-btn">☰</button>
    </div>
    <div class="ann-fab-action" id="ann-fab-mode">
      <span class="ann-fab-action-label" id="ann-fab-mode-label">Pause Annotating</span>
      <button class="ann-fab-action-btn">⏸</button>
    </div>
  `;
  document.body.appendChild(fabMenu);

  // Long-press ring
  const ring = document.createElement('div');
  ring.id = 'ann-longpress-ring';
  document.body.appendChild(ring);

  // Text selection bar (mobile)
  const selBar = document.createElement('div');
  selBar.id = 'ann-sel-bar';
  selBar.innerHTML = `✏️ Annotate Selection`;
  document.body.appendChild(selBar);

  // Comment dialog / bottom sheet
  const dialog = document.createElement('div');
  dialog.id = 'ann-dialog';
  dialog.style.display = 'none';
  dialog.innerHTML = `
    <div class="ann-sheet-handle"></div>
    <h4>Add Comment</h4>
    <div class="ann-context-preview" id="ann-dialog-preview"></div>
    <textarea id="ann-dialog-input" placeholder="Describe the issue or feedback…"></textarea>
    <div class="ann-dialog-actions">
      <button class="ann-btn" id="ann-dialog-cancel">Cancel</button>
      <button class="ann-btn primary" id="ann-dialog-save">Save</button>
    </div>
  `;
  document.body.appendChild(dialog);

  // Side / bottom panel
  const panel = document.createElement('div');
  panel.id = 'ann-panel';
  panel.innerHTML = `
    <div id="ann-panel-header">
      <h3>Annotations</h3>
      <button class="ann-btn" id="ann-panel-close">✕</button>
    </div>
    <div id="ann-panel-list"></div>
    <div id="ann-panel-footer">
      <button class="ann-btn primary" id="ann-copy-btn-2" style="width:100%;justify-content:center;">⎘ Copy Prompt</button>
      <button class="ann-btn danger" id="ann-clear-btn" style="width:100%;justify-content:center;">⊘ Clear All</button>
    </div>
  `;
  document.body.appendChild(panel);

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = 'ann-overlay';
  document.body.appendChild(overlay);

  // Toast
  const toast = document.createElement('div');
  toast.id = 'ann-toast';
  document.body.appendChild(toast);

  // Preview dialog
  const previewOverlay = document.createElement('div');
  previewOverlay.id = 'ann-preview-overlay';
  previewOverlay.innerHTML = `
    <div id="ann-preview-dialog">
      <div class="ann-preview-header">
        <div>
          <h3>Preview & Edit Prompt</h3>
          <p>Edit the prompt before copying — trim context or rephrase as needed.</p>
        </div>
        <button class="ann-preview-close" id="ann-preview-close" aria-label="Close">✕</button>
      </div>
      <textarea id="ann-preview-textarea" spellcheck="false"></textarea>
      <div class="ann-preview-footer">
        <span class="ann-preview-info" id="ann-preview-info">— bytes</span>
        <div class="ann-preview-actions">
          <button class="ann-preview-btn" id="ann-preview-reset">↺ Reset</button>
          <button class="ann-preview-btn primary" id="ann-preview-copy">⎘ Copy to Clipboard</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(previewOverlay);

  // ─── Responsive show/hide ─────────────────────────────────────────────────
  function applyResponsive() {
    const mobile = isMobile();
    toolbar.style.display = mobile ? 'none' : 'flex';
    fab.style.display = mobile ? 'flex' : 'none';
    fabMenu.style.display = mobile ? 'flex' : 'none';
  }
  applyResponsive();
  window.addEventListener('resize', applyResponsive);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function updateCount() {
    const n = annotations.length;
    document.querySelector('#ann-count span').textContent = n;
    const badge = document.getElementById('ann-fab-badge');
    badge.textContent = n;
    badge.classList.toggle('visible', n > 0);
  }

  function getCssSelector(el) {
    if (!el || el === document.body) return 'body';
    const path = [];
    let cur = el;
    while (cur && cur !== document.body) {
      let sel = cur.tagName.toLowerCase();
      if (cur.id) { sel += `#${cur.id}`; path.unshift(sel); break; }
      const classes = (cur.className && typeof cur.className === 'string')
        ? cur.className.trim().split(/\s+/).filter(c => !c.startsWith('ann-')).slice(0, 2).join('.')
        : '';
      if (classes) sel += `.${classes}`;
      const siblings = cur.parentNode ? Array.from(cur.parentNode.children).filter(s => s.tagName === cur.tagName) : [];
      if (siblings.length > 1) sel += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      path.unshift(sel);
      cur = cur.parentElement;
    }
    return path.join(' > ') || 'unknown';
  }

  function getTextSnippet(text, max = 120) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').slice(0, max) + (text.length > max ? '…' : '');
  }

  const IGNORE_SELS = ['#ann-toolbar','#ann-panel','#ann-dialog','#ann-toast','#ann-fab',
                       '#ann-fab-menu','#ann-sel-bar','#ann-overlay','#ann-longpress-ring','.ann-pin'];
  function isAnnotatorEl(el) {
    if (!el) return true;
    return IGNORE_SELS.some(sel => el.closest && el.closest(sel));
  }

  // ─── Dialog open/close ────────────────────────────────────────────────────
  let savedRange = null;

  function openDialog(pending, x, y) {
    pendingAnnotation = pending;
    const preview = pending.type === 'text'
      ? `"${getTextSnippet(pending.text, 80)}"`
      : `<${pending.target.tagName.toLowerCase()}> ${getTextSnippet(pending.target.innerText, 60)}`;
    document.getElementById('ann-dialog-preview').textContent = preview;
    document.getElementById('ann-dialog-input').value = '';
    dialog.style.display = 'block';

    if (isMobile()) {
      // Bottom sheet
      requestAnimationFrame(() => dialog.classList.add('sheet-open'));
      overlay.classList.add('visible');
    } else {
      // Positioned dialog
      const dw = 310, dh = 220;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = x + 12, top = y + 12;
      if (left + dw > vw - 8) left = x - dw - 12;
      if (top + dh > vh - 80) top = y - dh - 12;
      dialog.style.left = Math.max(8, left) + 'px';
      dialog.style.top = Math.max(8, top) + 'px';
    }
    setTimeout(() => document.getElementById('ann-dialog-input').focus(), 300);
  }

  function closeDialog() {
    if (isMobile()) {
      dialog.classList.remove('sheet-open');
      overlay.classList.remove('visible');
      setTimeout(() => { dialog.style.display = 'none'; }, 300);
    } else {
      dialog.style.display = 'none';
    }
    pendingAnnotation = null;
    clearLongpressTarget();
    selBar.classList.remove('visible');
    window.getSelection()?.removeAllRanges();
  }

  // ─── Save annotation ──────────────────────────────────────────────────────
  function saveAnnotation(comment) {
    if (!pendingAnnotation || !comment.trim()) return;
    const color = nextColor();
    const id = ++idCounter;
    const ann = { id, color, comment: comment.trim(), type: pendingAnnotation.type };

    if (pendingAnnotation.type === 'element') {
      const el = pendingAnnotation.target;
      ann.selector = getCssSelector(el);
      ann.outerHTML = el.cloneNode(false).outerHTML;
      ann.textSnippet = getTextSnippet(el.innerText);
      ann.el = el;
      el.classList.add('ann-highlighted');
      el.style.setProperty('--annotation-color', color);
      const pos = getComputedStyle(el).position;
      if (pos === 'static') el.style.position = 'relative';
      const pin = document.createElement('div');
      pin.className = 'ann-pin';
      pin.style.background = color;
      pin.textContent = id;
      pin.title = comment;
      el.appendChild(pin);
      ann.pin = pin;
    } else {
      ann.textSnippet = getTextSnippet(pendingAnnotation.text);
      const rangeToUse = pendingAnnotation.range || savedRange;
      ann.selector = rangeToUse
        ? getCssSelector(rangeToUse.commonAncestorContainer.parentElement)
        : 'text selection';
      try {
        if (rangeToUse) {
          const mark = document.createElement('mark');
          mark.className = 'ann-text-mark';
          mark.style.setProperty('--annotation-color', color);
          mark.title = `[${id}] ${comment}`;
          mark.dataset.annId = id;
          rangeToUse.surroundContents(mark);
          ann.mark = mark;
        }
      } catch (e) { /* complex range */ }
      savedRange = null;
      window.getSelection()?.removeAllRanges();
    }

    annotations.push(ann);
    updateCount();
    renderPanel();
    closeDialog();
    showToast(`#${id} saved`);
  }

  // ─── Panel ────────────────────────────────────────────────────────────────
  function renderPanel() {
    const list = document.getElementById('ann-panel-list');
    if (annotations.length === 0) {
      list.innerHTML = `<div style="color:var(--ann-muted);font-size:12px;text-align:center;padding:40px 16px;">
        No annotations yet.<br><br>
        ${isMobile() ? 'Long-press any element, or select text to annotate.' : 'Click elements or drag-select text to annotate.'}
      </div>`;
      return;
    }
    list.innerHTML = annotations.map(a => `
      <div class="ann-card" data-id="${a.id}">
        <div class="ann-card-header">
          <div class="ann-card-dot" style="background:${a.color}"></div>
          <div class="ann-card-meta">#${a.id} · ${a.type === 'text' ? '✏ text' : '⬚ element'} · <code style="font-size:9px">${a.selector.slice(-38)}</code></div>
          <button class="ann-card-del" data-del="${a.id}">✕</button>
        </div>
        <div class="ann-card-context">${a.textSnippet || '(no text)'}</div>
        <div class="ann-card-comment">${a.comment}</div>
      </div>
    `).join('');
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); removeAnnotation(parseInt(btn.dataset.del)); });
    });
  }

  function removeAnnotation(id) {
    const idx = annotations.findIndex(a => a.id === id);
    if (idx === -1) return;
    const ann = annotations[idx];
    if (ann.el) {
      ann.el.classList.remove('ann-highlighted');
      ann.el.style.removeProperty('--annotation-color');
      ann.pin?.remove();
    }
    if (ann.mark) ann.mark.replaceWith(ann.mark.textContent);
    annotations.splice(idx, 1);
    updateCount();
    renderPanel();
  }

  function openPanel() {
    panel.classList.add('open');
    if (isMobile()) overlay.classList.add('visible');
    closeFabMenu();
  }

  function closePanel() {
    panel.classList.remove('open');
    overlay.classList.remove('visible');
  }

  // ─── Prompt ───────────────────────────────────────────────────────────────
  function buildPrompt() {
    if (!annotations.length) return '// No annotations yet.';
    const lines = [
      'Below are annotations on an HTML document. Each annotation refers to a specific element or text selection.',
      '', `Total annotations: ${annotations.length}`, '', '---'
    ];
    annotations.forEach(a => {
      lines.push('', `### Annotation #${a.id} — ${a.type === 'text' ? 'Text Selection' : 'Element'}`);
      lines.push(`CSS Selector: ${a.selector}`);
      if (a.type === 'element' && a.outerHTML) lines.push(`Element tag: ${a.outerHTML}`);
      if (a.textSnippet) lines.push(`Context: "${a.textSnippet}"`);
      lines.push(`Comment: ${a.comment}`, '---');
    });
    lines.push('', 'Please address each annotation above in context of the HTML structure.');
    return lines.join('\n');
  }

  let pristinePrompt = '';

  /* @include shared/clipboard.js */
  // Note: showManualCopyHint() from shared targets #preview-textarea by default.
  // The annotator uses ann-prefixed IDs to avoid host-page collisions, so we
  // define a local hint helper that targets #ann-preview-textarea.

  function showAnnManualCopyHint() {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const shortcut = isMac ? '⌘ + C' : 'Ctrl + C';
    let hint = document.getElementById('ann-manual-copy-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'ann-manual-copy-hint';
      hint.style.cssText = `
        background: #2a1f1f;
        border-top: 1px solid #ff6b6b;
        border-bottom: 1px solid #ff6b6b;
        color: #ff6b6b;
        font-family: var(--ann-font);
        font-size: 11px;
        padding: 10px 22px;
        text-align: center;
        line-height: 1.5;
      `;
      const ta = document.getElementById('ann-preview-textarea');
      ta.parentElement.insertBefore(hint, ta);
    }
    hint.innerHTML = `<b>Browser blocked automatic copy.</b><br/>Text is selected below — press <b>${shortcut}</b> to copy manually.`;
  }

  function clearAnnManualCopyHint() {
    const hint = document.getElementById('ann-manual-copy-hint');
    if (hint) hint.remove();
  }

  function updatePreviewInfo() {
    const text = document.getElementById('ann-preview-textarea').value;
    const bytes = new Blob([text]).size;
    const kb = bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} bytes`;
    document.getElementById('ann-preview-info').textContent = `${kb} · ${annotations.length} annotations`;
  }

  function openPromptPreview() {
    if (!annotations.length) { showToast('No annotations yet'); return; }
    clearAnnManualCopyHint();
    pristinePrompt = buildPrompt();
    const ta = document.getElementById('ann-preview-textarea');
    ta.value = pristinePrompt;
    previewOverlay.classList.add('open');
    updatePreviewInfo();
    document.body.style.overflow = 'hidden';
    closeFabMenu();
  }

  function closePromptPreview() {
    clearAnnManualCopyHint();
    previewOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function copyPrompt() {
    // Replaced direct-copy with preview-first flow
    openPromptPreview();
  }

  // Preview dialog wiring
  document.getElementById('ann-preview-close').addEventListener('click', closePromptPreview);
  previewOverlay.addEventListener('click', e => {
    if (e.target === previewOverlay) closePromptPreview();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && previewOverlay.classList.contains('open')) closePromptPreview();
  });
  document.getElementById('ann-preview-textarea').addEventListener('input', updatePreviewInfo);
  document.getElementById('ann-preview-reset').addEventListener('click', () => {
    document.getElementById('ann-preview-textarea').value = pristinePrompt;
    updatePreviewInfo();
    showToast('↺ Reset to generated prompt');
  });
  document.getElementById('ann-preview-copy').addEventListener('click', async () => {
    const ta = document.getElementById('ann-preview-textarea');
    const text = ta.value;
    const result = await copyToClipboardSafe(text);
    if (result === 'auto') {
      showToast('✓ Prompt copied!');
      closePromptPreview();
    } else {
      ta.focus(); ta.select();
      ta.setSelectionRange(0, text.length);
      showAnnManualCopyHint();
    }
  });

  // ─── FAB menu ─────────────────────────────────────────────────────────────
  let fabMenuOpen = false;
  function toggleFabMenu() {
    fabMenuOpen = !fabMenuOpen;
    fabMenu.classList.toggle('open', fabMenuOpen);
    fab.textContent = fabMenuOpen ? '✕' : '✏️';
    const badge = document.createElement('span');
    badge.className = 'ann-fab-badge' + (annotations.length > 0 ? ' visible' : '');
    badge.id = 'ann-fab-badge';
    badge.textContent = annotations.length;
    if (!fabMenuOpen) fab.innerHTML = `✏️<span class="ann-fab-badge${annotations.length > 0 ? ' visible' : ''}" id="ann-fab-badge">${annotations.length}</span>`;
  }
  function closeFabMenu() {
    fabMenuOpen = false;
    fabMenu.classList.remove('open');
    fab.innerHTML = `✏️<span class="ann-fab-badge${annotations.length > 0 ? ' visible' : ''}" id="ann-fab-badge">${annotations.length}</span>`;
  }

  fab.addEventListener('click', e => { e.stopPropagation(); toggleFabMenu(); });
  document.getElementById('ann-fab-copy').addEventListener('click', copyPrompt);
  document.getElementById('ann-fab-review').addEventListener('click', () => { openPanel(); });
  document.getElementById('ann-fab-mode').addEventListener('click', () => {
    annotationMode = !annotationMode;
    const label = document.getElementById('ann-fab-mode-label');
    label.textContent = annotationMode ? 'Pause Annotating' : 'Resume Annotating';
    showToast(annotationMode ? 'Annotation mode on' : 'Annotation mode paused');
    closeFabMenu();
  });

  // ─── Long-press (mobile element selection) ────────────────────────────────
  let lpTimer = null;
  let lpTarget = null;
  let lpStartX = 0, lpStartY = 0;
  const LP_MS = 600;
  const MOVE_THRESHOLD = 10;

  function clearLongpressTarget() {
    if (lpTarget) { lpTarget.classList.remove('ann-longpress-target'); lpTarget = null; }
    ring.classList.remove('charging', 'fired');
    ring.style.opacity = '0';
  }

  function startLongpress(el, x, y) {
    if (!annotationMode || isAnnotatorEl(el)) return;
    clearLongpressTarget();
    lpTarget = el;
    lpStartX = x; lpStartY = y;
    el.classList.add('ann-longpress-target');
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    ring.classList.remove('fired');
    ring.style.opacity = '0';
    ring.style.transform = 'scale(0.5)';
    requestAnimationFrame(() => {
      ring.classList.add('charging');
    });
    lpTimer = setTimeout(() => {
      ring.classList.remove('charging');
      ring.classList.add('fired');
      navigator.vibrate && navigator.vibrate(30);
      openDialog({ type: 'element', target: lpTarget }, x, y);
      clearTimeout(lpTimer); lpTimer = null;
    }, LP_MS);
  }

  function cancelLongpress() {
    if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    clearLongpressTarget();
  }

  document.addEventListener('touchstart', e => {
    if (!isMobile() || !annotationMode) return;
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (!el || isAnnotatorEl(el)) return;
    // Don't trigger longpress if text is being selected
    startLongpress(el, t.clientX, t.clientY);
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!lpTimer) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - lpStartX), dy = Math.abs(t.clientY - lpStartY);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) cancelLongpress();
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (lpTimer) cancelLongpress(); // didn't hold long enough
  }, { passive: true });

  // ─── Text selection (mobile) ──────────────────────────────────────────────
  // Use selectionchange to detect native text selection on mobile
  let selChangeTimer = null;
  document.addEventListener('selectionchange', () => {
    if (!annotationMode) return;
    clearTimeout(selChangeTimer);
    selChangeTimer = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.toString().trim().length < 2) {
        selBar.classList.remove('visible');
        return;
      }
      // Cancel any pending longpress — user is selecting text
      cancelLongpress();
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      savedRange = range.cloneRange();
      const text = sel.toString().trim();

      if (isMobile()) {
        // Position sel bar above selection
        const barY = Math.max(8, rect.top + window.scrollY - 48);
        const barX = Math.max(8, rect.left + (rect.width / 2) - 80);
        selBar.style.left = barX + 'px';
        selBar.style.top = barY + 'px';
        selBar.style.position = 'absolute';
        selBar.classList.add('visible');
        selBar.dataset.text = text;
      }
    }, 200);
  });

  selBar.addEventListener('mousedown', e => e.preventDefault()); // don't lose selection
  selBar.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const sel = window.getSelection();
    const text = sel?.toString().trim() || selBar.dataset.text || '';
    const range = savedRange || (sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null);
    if (text) {
      selBar.classList.remove('visible');
      openDialog({ type: 'text', text, range }, window.innerWidth / 2, window.innerHeight / 2);
    }
  });

  // ─── Desktop events ───────────────────────────────────────────────────────
  let tempHighlightEl = null;

  document.addEventListener('mouseover', e => {
    if (isMobile() || !annotationMode || dialog.style.display !== 'none') return;
    if (isAnnotatorEl(e.target)) return;
    if (tempHighlightEl && tempHighlightEl !== e.target) tempHighlightEl.classList.remove('ann-hover-target');
    e.target.classList.add('ann-hover-target');
    tempHighlightEl = e.target;
  }, true);

  document.addEventListener('mouseout', e => {
    if (isMobile() || !annotationMode) return;
    e.target.classList.remove('ann-hover-target');
  }, true);

  document.addEventListener('click', e => {
    if (isMobile() || !annotationMode) return;
    if (isAnnotatorEl(e.target)) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    e.preventDefault(); e.stopPropagation();
    if (tempHighlightEl) tempHighlightEl.classList.remove('ann-hover-target');
    openDialog({ type: 'element', target: e.target }, e.clientX, e.clientY);
  }, true);

  document.addEventListener('mouseup', e => {
    if (isMobile() || !annotationMode) return;
    if (isAnnotatorEl(e.target)) return;
    if (dialog.style.display !== 'none') return;
    const sel = window.getSelection();
    if (!sel || sel.toString().trim().length === 0) return;
    const range = sel.getRangeAt(0).cloneRange();
    const text = sel.toString().trim();
    setTimeout(() => openDialog({ type: 'text', text, range }, e.clientX, e.clientY), 10);
  }, true);

  // ─── Dialog/sheet events ──────────────────────────────────────────────────
  document.getElementById('ann-dialog-save').addEventListener('click', () => {
    const val = document.getElementById('ann-dialog-input').value;
    if (!val.trim()) { document.getElementById('ann-dialog-input').focus(); return; }
    saveAnnotation(val);
  });
  document.getElementById('ann-dialog-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      const v = e.target.value; if (v.trim()) saveAnnotation(v);
    }
    if (e.key === 'Escape') closeDialog();
  });
  document.getElementById('ann-dialog-cancel').addEventListener('click', closeDialog);

  // ─── Desktop toolbar events ───────────────────────────────────────────────
  document.getElementById('ann-toggle-btn').addEventListener('click', () => {
    annotationMode = !annotationMode;
    const btn = document.getElementById('ann-toggle-btn');
    btn.textContent = annotationMode ? '● Mode On' : '○ Mode Off';
    btn.classList.toggle('active', annotationMode);
    if (!annotationMode && tempHighlightEl) { tempHighlightEl.classList.remove('ann-hover-target'); tempHighlightEl = null; }
  });
  document.getElementById('ann-panel-btn').addEventListener('click', openPanel);
  document.getElementById('ann-panel-close').addEventListener('click', closePanel);
  document.getElementById('ann-copy-btn').addEventListener('click', copyPrompt);
  document.getElementById('ann-copy-btn-2').addEventListener('click', copyPrompt);
  document.getElementById('ann-clear-btn').addEventListener('click', () => {
    if (!annotations.length || !confirm(`Clear all ${annotations.length} annotations?`)) return;
    [...annotations].forEach(a => removeAnnotation(a.id));
    showToast('Cleared');
  });

  // ─── Overlay / backdrop ───────────────────────────────────────────────────
  overlay.addEventListener('click', () => {
    closeDialog();
    closePanel();
  });

  // Close FAB menu on outside tap
  document.addEventListener('click', e => {
    if (fabMenuOpen && !fab.contains(e.target) && !fabMenu.contains(e.target)) closeFabMenu();
  });

  // ─── Init ─────────────────────────────────────────────────────────────────
  renderPanel();
  console.log('%c◈ Annotator v2 loaded ', 'background:#7c6fff;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold;');
})();
