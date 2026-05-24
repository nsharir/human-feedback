'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   The rule text injected into the agent's context at session/prompt time.

   The hook delivers this via each harness's native context-injection channel
   (Claude Code SessionStart/UserPromptSubmit `additionalContext`, Codex
   SessionStart `additionalContext`, Cursor beforeSubmitPrompt `agentMessage`,
   Hermes `pre_llm_call` ephemeral context).

   No project markdown files (CLAUDE.md / AGENTS.md / .cursorrules / .cursor/
   rules/) are ever touched.
   ───────────────────────────────────────────────────────────────────────────── */

const RULE_TEXT = `[agent-feedback] >1-question rule (non-negotiable):

If you are about to ask the user MORE THAN ONE question in a single reply,
STOP. Do NOT ask inline. Instead, write a questions.json file using the
schema below. The post-write hook will compile it to an HTML form and
auto-open it in the user's browser. The user fills the form, pastes a
structured response back, and only THEN do you continue.

A single yes/no or trivial confirmation may stay inline. Two or more
substantive questions → questionnaire, no exceptions.

This rule applies the FIRST time you would ask 2+ questions — do not ask
inline first and only switch to a questionnaire when the user pushes back.
That is the failure mode the rule exists to prevent. If on first read of
the user's request you can already enumerate 2+ open questions, write
questions.json immediately.

questions.json schema:
{
  "title": "Short session title",
  "description": "One-paragraph context shown above the form",
  "questions": [
    { "id": "q1", "text": "Your question?", "type": "text",     "hint": "optional placeholder" },
    { "id": "q2", "text": "Pick one",       "type": "radio",    "options": ["A", "B", "C"] },
    { "id": "q3", "text": "Pick many",      "type": "checkbox", "options": ["X", "Y", "Z"] }
  ]
}

After writing it, your entire reply should be exactly:
  questionnaire opened ✓ — waiting on your response.

Do NOT print the file path. Do NOT say "fill it out at ...". Do NOT continue
with tool calls that depend on the user's answers until they respond.

Opt-outs (user-controlled, do not toggle these yourself):
  AGENT_FEEDBACK_DISABLED=1   skip the hook entirely
  AGENT_FEEDBACK_AUTO_OPEN=0  wrap but do not open a browser`;

module.exports = {
  RULE_TEXT,
};
