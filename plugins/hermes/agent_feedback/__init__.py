"""
agent-feedback Hermes plugin

Listens for post_tool_call events. When the agent writes a .md / .html file,
invokes the shared Node hook script to wrap it with the feedback framework.

Install location:  ~/.hermes/plugins/agent_feedback/
"""

import json
import os
import subprocess
import shutil


PLUGIN_NAME = "agent_feedback"
WRITE_TOOLS = {"write_file", "edit_file", "create_file", "str_replace", "apply_patch"}


def _resolve_node_hook():
    """Find the Node hook script. Installed alongside the @nsharir/agent-feedback package."""
    # 1. Env var override (set by the installer)
    env_path = os.environ.get("AGENT_FEEDBACK_HOOK_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
    # 2. Use `agent-feedback` from PATH if available
    if shutil.which("agent-feedback"):
        return None  # signal to use the named binary
    return None


def post_tool_call(context):
    """
    Hermes plugin entry point — fires after every tool call.

    `context` is a dict with at least: { tool: str, args: dict, result: any }
    We extract the file path the tool wrote and forward it to the shared
    Node hook script.
    """
    try:
        tool = context.get("tool") or ""
        if tool not in WRITE_TOOLS:
            return None

        args = context.get("args") or {}
        file_path = args.get("file_path") or args.get("path") or args.get("filename")
        if not file_path:
            return None

        # Build the event payload the shared script expects
        event = {
            "harness": "hermes",
            "tool": tool,
            "file_path": file_path,
        }

        # Resolve hook invocation
        hook_path = _resolve_node_hook()
        if hook_path:
            cmd = ["node", hook_path]
        else:
            binary = shutil.which("agent-feedback") or "agent-feedback"
            cmd = [binary, "__hook"]

        result = subprocess.run(
            cmd,
            input=json.dumps(event),
            capture_output=True,
            text=True,
            timeout=20,
        )

        if result.returncode != 0:
            return None

        # The Node hook responds with { "message": "..." }; relay to the agent
        try:
            response = json.loads(result.stdout or "{}")
        except json.JSONDecodeError:
            return None

        msg = response.get("message")
        if msg:
            # Hermes plugin convention: return a dict with `system_message` to
            # inject context for the next LLM call
            return {"system_message": msg}

    except Exception as e:
        # Never block the agent on a hook failure
        return None

    return None


# Hermes plugin metadata
__plugin__ = {
    "name": PLUGIN_NAME,
    "version": "1.0.0",
    "description": "Auto-wraps agent-produced files with the agent-feedback framework",
    "hooks": {
        "post_tool_call": post_tool_call,
    },
}
