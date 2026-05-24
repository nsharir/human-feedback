/* ─────────────────────────────────────────────────────────────────────────────
   Preview dialog controller — shared across all three tools.

   Public API (assumes preview-dialog.html + preview-dialog.css + clipboard.js
   + toast.js have all been included in the page):

     PreviewDialog.open({ payload, onCopySuccess? })   open with pristine payload
     PreviewDialog.close()                              close it
     PreviewDialog.isOpen()                             boolean

   The dialog manages its own reset, copy, and manual-fallback logic.
   ───────────────────────────────────────────────────────────────────────────── */

const PreviewDialog = (function () {
  let pristine = '';
  let onCopySuccess = null;
  let initialized = false;

  function el(id) { return document.getElementById(id); }

  function updateInfo() {
    const text = el('preview-textarea').value;
    const bytes = new Blob([text]).size;
    const kb = bytes >= 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' bytes';
    const info = el('preview-info');
    if (info) info.textContent = kb;
  }

  function open(opts) {
    initialize();
    pristine = opts.payload;
    onCopySuccess = opts.onCopySuccess || null;
    clearManualCopyHint();
    el('preview-textarea').value = pristine;
    el('preview-overlay').classList.add('open');
    updateInfo();
    document.body.style.overflow = 'hidden';
  }

  function close() {
    clearManualCopyHint();
    el('preview-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function isOpen() {
    const overlay = el('preview-overlay');
    return overlay && overlay.classList.contains('open');
  }

  async function doCopy() {
    const text = el('preview-textarea').value;
    const result = await copyToClipboardSafe(text);
    if (result === 'auto') {
      showToast('✓ Copied to clipboard!', 'success');
      close();
      if (typeof onCopySuccess === 'function') onCopySuccess();
    } else {
      showManualCopyHint();
    }
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    el('preview-close').addEventListener('click', close);
    el('preview-overlay').addEventListener('click', function (e) {
      if (e.target.id === 'preview-overlay') close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });
    el('preview-textarea').addEventListener('input', updateInfo);
    el('preview-reset').addEventListener('click', function () {
      el('preview-textarea').value = pristine;
      updateInfo();
      showToast('↺ Reset to generated output');
    });
    el('preview-copy').addEventListener('click', doCopy);
  }

  return { open, close, isOpen };
})();
