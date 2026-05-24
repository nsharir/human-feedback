/* ─────────────────────────────────────────────────────────────────────────────
   Toast notification — shared across all tools.
   Requires a #toast element in the DOM and matching CSS.
   ───────────────────────────────────────────────────────────────────────────── */

function showToast(msg, kind) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = '';
  if (kind) toast.classList.add(kind);
  const raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : function (fn) { return setTimeout(fn, 16); };
  raf(function () { toast.classList.add('show'); });
  setTimeout(function () { toast.classList.remove('show'); }, 2400);
}
