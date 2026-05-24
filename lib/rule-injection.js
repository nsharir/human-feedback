'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   Rule text injected into each agent's context at session start / prompt
   submit / pre_llm_call. Token-optimized — every word earns its keep.

   Two contracts:
     1. >1-question rule       → questions.json file
     2. Review-artifact rule   → `<topic>-review.md` / `-review.html` suffix
                                 triggers auto-wrap + auto-open; agent stops
                                 and waits for the user's response

   The shared post-write hook is the single delivery channel for both rules
   AND the wrap behavior. There is no second hook.
   ───────────────────────────────────────────────────────────────────────────── */

const RULE_TEXT = `[agent-feedback] Contract — read once, follow always.

QUESTIONS (>1-question rule):
If you would ask the user ≥2 substantive questions in one reply, STOP. Write
\`questions.json\` (schema below) instead — the hook wraps it as a form. The
hook will print a \`file://...\` link in its post-tool ack; relay that link to
the user verbatim so they can click to open it. On Hermes WebUI also include
the \`MEDIA:<path>\` token the hook emits — WebUI renders it as an inline
sandboxed iframe in the chat, so the user does not need to navigate away.
Reply ONLY:
"questionnaire ready ✓ — open: <file://link> — waiting on your response.
MEDIA:<wrapped-output-path>"
then wait. (Omit the MEDIA line on non-Hermes harnesses.) Single y/n or
trivial confirmation may stay inline. Do not ask inline first.

REVIEW ARTIFACTS (-review suffix rule):
For artifacts the user must review (spec, design, UX mock, plan, proposal),
name the file \`<topic>-review.md\` or \`<topic>-review.html\`. The hook wraps
it as a review surface and emits a \`file://...\` link plus (on Hermes) a
\`MEDIA:<path>\` token. Relay both to the user. Reply ONLY:
"review ready ✓ — open: <file://link> — waiting on your response.
MEDIA:<wrapped-output-path>"
then wait. Do NOT auto-open via terminal. Do NOT say "open it in your editor".

Internal files (CHANGELOG, README, AGENTS.md, CLAUDE.md, SKILL.md, source
code, notes, scratch) do NOT get the -review suffix — write them normally,
don't halt, no review surface is generated.

questions.json schema:
{
  "title": "Short title",
  "description": "One paragraph of context",
  "questions": [
    { "id": "q1", "text": "?", "type": "text",     "hint": "optional" },
    { "id": "q2", "text": "?", "type": "radio",    "options": ["A","B"] },
    { "id": "q3", "text": "?", "type": "checkbox", "options": ["X","Y"] }
  ]
}
\`radio\`, \`checkbox\`, and \`select\` include an "Other…" free-text option by
default; opt out per-question with \`"other": false\`.

Opt-outs (user-controlled, do not toggle yourself):
  AGENT_FEEDBACK_DISABLED=1    skip the hook entirely
  AGENT_FEEDBACK_AUTO_OPEN=1   auto-launch a browser (default: off, share link)`;

// ── Hermes-only addendum ────────────────────────────────────────────────────
// Appended to the rule text ONLY when the rule is delivered through a
// Hermes channel (pre_llm_call injection or MEMORY.md fallback). Other
// harnesses do not get this because the [Workspace::v1: ...] convention
// and the .hermes/plans/ directory are Hermes-specific.
const HERMES_ADDENDUM = `

HERMES WORKSPACE PATH (Hermes only):
Write \`questions*.json\` and \`<topic>-review.md\` / \`-review.html\` files
into the active workspace's plans directory:
  <workspace>/.hermes/plans/<filename>
where <workspace> is the absolute path from the most recent
\`[Workspace::v1: /abs/path]\` tag on the user's message (the tag is the
single authoritative source of the active workspace). Create the
\`.hermes/plans/\` directory if it does not exist — \`write_file\` and
\`patch\` create parent directories automatically.

Do not write these files into \`/tmp\`, into the repo root, or under your
home directory. The user expects them in the workspace so they live next
to the project they refer to and so the hook's relative-path output stays
sensible. Plain prose notes, throwaway scratch files, and tool-internal
artifacts can still go wherever they normally would — this rule is only
about questionnaires and review surfaces.`;

module.exports = {
  RULE_TEXT,
  HERMES_ADDENDUM,
};
