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
\`questions.json\` (schema below) instead — the hook auto-opens it as a form.
Reply ONLY: "questionnaire opened ✓ — waiting on your response." then wait.
Single y/n or trivial confirmation may stay inline. Do not ask inline first.

REVIEW ARTIFACTS (-review suffix rule):
For artifacts the user must review (spec, design, UX mock, plan, proposal),
name the file \`<topic>-review.md\` or \`<topic>-review.html\`. The hook
auto-compiles it to a side-by-side review surface and opens it in the user's
browser. Reply ONLY: "review opened ✓ — waiting on your response." then wait.
Do NOT print the path. Do NOT say "open it in your editor".

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

Opt-outs (user-controlled, do not toggle yourself):
  AGENT_FEEDBACK_DISABLED=1    skip the hook entirely
  AGENT_FEEDBACK_AUTO_OPEN=0   wrap but don't launch a browser`;

module.exports = {
  RULE_TEXT,
};
