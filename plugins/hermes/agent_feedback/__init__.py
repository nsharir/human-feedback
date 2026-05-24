"""
agent-feedback Hermes plugin

Two responsibilities:

1. ``post_tool_call`` — when the agent writes a .md / .html / .json file,
   forward the file path to the shared Node hook script, which wraps it as
   an HTML feedback surface and auto-opens it in the user's browser.

2. ``pre_llm_call`` — on the first LLM call of every session, inject the
   >1-question rule into the conversation context. We do this exactly once
   per session to avoid invalidating the prompt cache on every turn.

Install location:  ~/.hermes/plugins/agent_feedback/

Hermes contract: every plugin module must expose a ``register(ctx)`` function
that calls ``ctx.register_hook(name, callback)`` for each hook it wants. The
``__plugin__`` dict used by earlier versions of this plugin was never picked
up by Hermes' loader — that's why the prior auto-wrap was inert in Hermes.
"""

import json
import os
import subprocess
import shutil


PLUGIN_NAME = "agent_feedback"
WRITE_TOOLS = {"write_file", "edit_file", "create_file", "str_replace", "apply_patch"}

# Track which sessions have already received the rule injection. Keyed by
# session_id (or a sentinel when no session_id is available). The set is
# module-level — fine because the rule text is identical every call; we just
# want to avoid duplicating it within one session.
_RULE_INJECTED_SESSIONS: set = set()


def _resolve_node_hook():
    """Find the Node hook script. Installed alongside the @nsharir/agent-feedback package."""
    env_path = os.environ.get("AGENT_FEEDBACK_HOOK_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
    if shutil.which("agent-feedback"):
        return None  # signal: use the named binary
    return None


def _invoke_node_hook(event: dict):
    """Run the shared Node hook with the given event payload. Returns parsed
    JSON response, or ``None`` on any failure. Never raises."""
    hook_path = _resolve_node_hook()
    if hook_path:
        cmd = ["node", hook_path]
    else:
        binary = shutil.which("agent-feedback") or "agent-feedback"
        cmd = [binary, "__hook"]

    try:
        result = subprocess.run(
            cmd,
            input=json.dumps(event),
            capture_output=True,
            text=True,
            timeout=20,
        )
    except Exception:
        return None

    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return None


# ── Hook callbacks ──────────────────────────────────────────────────────────


def _post_tool_call(**kwargs):
    """Wrap written files with the agent-feedback surface."""
    try:
        tool = kwargs.get("tool") or kwargs.get("tool_name") or ""
        if tool not in WRITE_TOOLS:
            return None

        args = kwargs.get("args") or kwargs.get("tool_args") or {}
        file_path = args.get("file_path") or args.get("path") or args.get("filename")
        if not file_path:
            return None

        response = _invoke_node_hook({
            "harness": "hermes",
            "tool": tool,
            "file_path": file_path,
        })
        if not response:
            return None

        msg = response.get("message")
        if msg:
            return {"system_message": msg}
    except Exception:
        return None
    return None


def _pre_llm_call(**kwargs):
    """Inject the >1-question rule on the first LLM call of each session.

    Hermes injects ``pre_llm_call`` return values into the current turn's
    user message (never the system prompt) to preserve prompt caching. We
    return a plain string. After the first call of a session, return None
    so the cache prefix stays stable.
    """
    if os.environ.get("AGENT_FEEDBACK_DISABLED") == "1":
        return None

    session_id = kwargs.get("session_id") or "__no_session__"
    if session_id in _RULE_INJECTED_SESSIONS:
        return None
    _RULE_INJECTED_SESSIONS.add(session_id)

    response = _invoke_node_hook({
        "harness": "hermes",
        "event": "pre_llm_call",
    })
    if not response:
        return None
    msg = response.get("message")
    if not msg:
        return None
    return msg


def _on_session_reset(**kwargs):
    """Re-arm the rule injection after /reset so the next pre_llm_call fires."""
    session_id = kwargs.get("session_id")
    if session_id:
        _RULE_INJECTED_SESSIONS.discard(session_id)


# ── Hermes plugin entrypoint ────────────────────────────────────────────────


def register(ctx):
    """Hermes calls this once at plugin load. Wire up our three hooks."""
    ctx.register_hook("post_tool_call", _post_tool_call)
    ctx.register_hook("pre_llm_call", _pre_llm_call)
    ctx.register_hook("on_session_reset", _on_session_reset)


# Legacy alias kept so older `from agent_feedback import post_tool_call` callers
# (if any exist in the wild) keep working.
post_tool_call = _post_tool_call
pre_llm_call = _pre_llm_call
on_session_reset = _on_session_reset
