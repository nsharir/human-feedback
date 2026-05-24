/* ─────────────────────────────────────────────────────────────────────────────
   Clipboard — 3-tier fallback strategy.

   Returns 'auto' if the text was copied automatically (success),
   or 'manual' if the caller must fall back to user-initiated copy.

   Tier 1: navigator.clipboard.writeText  (requires secure context)
   Tier 2: document.execCommand('copy')   (deprecated, broad fallback)
   Tier 3: caller selects a visible textarea + shows shortcut hint
   ───────────────────────────────────────────────────────────────────────────── */

async function copyToClipboardSafe(text) {
  // Tier 1: modern clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return 'auto';
    } catch (e) {
      console.warn('clipboard API failed:', e);
    }
  }
  // Tier 2: execCommand fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return 'auto';
  } catch (e) {
    console.warn('execCommand fallback failed:', e);
  }
  // Tier 3: manual — caller handles selection + user-facing hint
  return 'manual';
}

/* Show a manual-copy hint inside the preview dialog.
   Auto-selects the textarea and tells the user which keyboard shortcut to press. */
function showManualCopyHint() {
  const textarea = document.getElementById('preview-textarea');
  if (!textarea) return;
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const shortcut = isMac ? '⌘ + C' : 'Ctrl + C';

  let hint = document.getElementById('manual-copy-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'manual-copy-hint';
    textarea.parentElement.insertBefore(hint, textarea);
  }
  hint.innerHTML = '<b>Browser blocked automatic copy.</b><br/>Text is selected below — press <b>' + shortcut + '</b> to copy manually.';
}

function clearManualCopyHint() {
  const hint = document.getElementById('manual-copy-hint');
  if (hint) hint.remove();
}
