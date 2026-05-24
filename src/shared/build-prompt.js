/* ─────────────────────────────────────────────────────────────────────────────
   Shared agent-prompt builder — used by all three tools so the "Copy Prompt"
   output is consistent (free text only, no JSON).

   Exposes: window.buildAgentPrompt({ tool, source, items, intro })

     tool   — 'annotator' | 'md-annotator' | 'feedback'
     source — descriptive filename / title shown to the agent (optional)
     intro  — optional override for the leading sentence
     items  — Array of:
                {
                  heading:   'Item label (e.g. "Annotation #1 — Element")',
                  typeLabel: optional secondary label,
                  lineRef:   optional line reference (md tool),
                  selector:  optional CSS selector (html tool),
                  snippet:   optional quoted source snippet,
                  comment:   the user's comment/answer (REQUIRED),
                }

   Returns a string like:

     The user reviewed <document kind> and provided the following feedback.

     Source: <filename>
     Total items: N
     Generated: <ISO timestamp>

     ---

     ## Item 1 — <heading>
     <details>
     Comment: <body>

     ---

     ...

     Please address each item above.
   ───────────────────────────────────────────────────────────────────────────── */
(function (root) {
  var DEFAULT_INTRO = {
    'annotator':    'The user reviewed a draft HTML page and provided the following feedback.',
    'md-annotator': 'The user reviewed the document and provided the following feedback.',
    'feedback':     'The user completed a questionnaire and provided the following feedback.',
  };

  function buildAgentPrompt(opts) {
    opts = opts || {};
    var tool   = opts.tool || 'feedback';
    var source = opts.source || '';
    var items  = Array.isArray(opts.items) ? opts.items : [];
    var intro  = opts.intro || DEFAULT_INTRO[tool] || DEFAULT_INTRO.feedback;

    var lines = [intro, ''];
    if (source) lines.push('Source: ' + source);
    lines.push('Total items: ' + items.length);
    lines.push('Generated: ' + new Date().toISOString());
    lines.push('', '---');

    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {};
      var headBits = ['## Item ' + (i + 1)];
      if (it.heading) headBits.push('— ' + it.heading);
      lines.push('', headBits.join(' '));

      if (it.typeLabel) lines.push('Type: ' + it.typeLabel);
      if (it.lineRef)   lines.push('Line: '  + it.lineRef);
      if (it.selector)  lines.push('Selector: ' + it.selector);

      if (it.snippet) {
        var snip = String(it.snippet);
        if (snip.indexOf('\n') >= 0) {
          lines.push('Context:', '```', snip, '```');
        } else {
          lines.push('Context: "' + snip + '"');
        }
      }

      var comment = it.comment == null ? '' : String(it.comment);
      lines.push('Comment: ' + comment);
      lines.push('', '---');
    }

    lines.push('', 'Please address each item above.');
    return lines.join('\n');
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildAgentPrompt: buildAgentPrompt };
  }
  if (root) root.buildAgentPrompt = buildAgentPrompt;
}(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this)));
