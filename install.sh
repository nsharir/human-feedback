#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#   human-feedback bootstrap installer
#
#   Usage:
#     curl -fsSL https://raw.githubusercontent.com/nsharir/human-feedback/main/install.sh | bash
#
#   Environment variables:
#     HUMAN_FEEDBACK_HOME   Install directory (default: ~/.human-feedback)
#     HUMAN_FEEDBACK_BIN    Symlink directory (default: ~/.local/bin)
#     HUMAN_FEEDBACK_REF    Git ref to install (default: main)
#     HUMAN_FEEDBACK_REPO   Git repo URL (default: https://github.com/nsharir/human-feedback.git)
#     DRY_RUN=1             Print what would happen without executing
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="${HUMAN_FEEDBACK_REPO:-https://github.com/nsharir/human-feedback.git}"
REF="${HUMAN_FEEDBACK_REF:-main}"
HOME_DIR="${HUMAN_FEEDBACK_HOME:-$HOME/.human-feedback}"
BIN_DIR="${HUMAN_FEEDBACK_BIN:-$HOME/.local/bin}"
DRY_RUN="${DRY_RUN:-0}"

# ── pretty output ────────────────────────────────────────────────────────────
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_BOLD=$(printf '\033[1m')
  C_DIM=$(printf '\033[2m')
  C_GREEN=$(printf '\033[32m')
  C_YELLOW=$(printf '\033[33m')
  C_RED=$(printf '\033[31m')
  C_CYAN=$(printf '\033[36m')
  C_RESET=$(printf '\033[0m')
else
  C_BOLD="" C_DIM="" C_GREEN="" C_YELLOW="" C_RED="" C_CYAN="" C_RESET=""
fi

say()  { printf '%s\n' "$*"; }
ok()   { printf '  %s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
info() { printf '  %s·%s %s\n' "$C_DIM" "$C_RESET" "$*"; }
warn() { printf '  %s⚠%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
die()  { printf '  %s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

run() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '  %s$%s %s\n' "$C_DIM" "$C_RESET" "$*"
  else
    "$@"
  fi
}

# ── banner ───────────────────────────────────────────────────────────────────
printf '\n'
printf '  %shuman-feedback installer%s\n' "$C_BOLD" "$C_RESET"
printf '  %sclose the loop on AI agent output%s\n\n' "$C_DIM" "$C_RESET"

# ── pre-flight ───────────────────────────────────────────────────────────────
info "checking prerequisites…"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    die "$1 is required but not installed.${2:+ $2}"
  fi
}
need git "Install via your package manager: 'brew install git' on macOS, 'apt install git' on Debian/Ubuntu."
need node "Install Node.js 18+ from https://nodejs.org or via nvm: 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash'."
need npm  "npm ships with Node.js; reinstall Node to get it."

# Node version check (>= 18)
node_major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$node_major" -lt 18 ]; then
  die "Node.js 18+ required (found v$(node -v)). Upgrade Node and re-run."
fi

ok "git $(git --version | awk '{print $3}')"
ok "node $(node -v)"
ok "npm  $(npm -v)"
printf '\n'

# ── clone or update ──────────────────────────────────────────────────────────
if [ -d "$HOME_DIR/.git" ]; then
  info "updating $HOME_DIR (ref: $REF)…"
  run git -C "$HOME_DIR" fetch --tags --quiet origin
  run git -C "$HOME_DIR" checkout --quiet "$REF"
  # Only reset if we're on a branch; tagged refs are detached HEAD and reset would fail.
  if git -C "$HOME_DIR" symbolic-ref -q HEAD >/dev/null 2>&1; then
    run git -C "$HOME_DIR" reset --hard --quiet "origin/$REF"
  fi
  ok "repository updated"
elif [ -d "$HOME_DIR" ]; then
  die "$HOME_DIR exists but is not a git repository. Remove it or set HUMAN_FEEDBACK_HOME to a different path."
else
  info "cloning $REPO_URL into $HOME_DIR…"
  run git clone --depth=1 --branch "$REF" --quiet "$REPO_URL" "$HOME_DIR"
  ok "repository cloned"
fi
printf '\n'

# ── install runtime deps + build ─────────────────────────────────────────────
info "installing runtime dependencies…"
run npm --prefix "$HOME_DIR" install --omit=dev --no-audit --no-fund --silent
ok "dependencies installed"

info "building templates…"
run npm --prefix "$HOME_DIR" run build --silent
ok "templates built"
printf '\n'

# ── symlink ──────────────────────────────────────────────────────────────────
info "linking CLI into $BIN_DIR…"
run mkdir -p "$BIN_DIR"
run chmod +x "$HOME_DIR/bin/cli.js"

LINK_PATH="$BIN_DIR/human-feedback"
if [ -L "$LINK_PATH" ] || [ -e "$LINK_PATH" ]; then
  run rm -f "$LINK_PATH"
fi
run ln -s "$HOME_DIR/bin/cli.js" "$LINK_PATH"
ok "symlink created: $LINK_PATH → $HOME_DIR/bin/cli.js"
printf '\n'

# ── PATH check ───────────────────────────────────────────────────────────────
case ":$PATH:" in
  *":$BIN_DIR:"*)
    ok "$BIN_DIR is on your PATH"
    ;;
  *)
    warn "$BIN_DIR is not on your PATH"
    printf '\n'
    printf '    Add this to your %s~/.zshrc%s or %s~/.bashrc%s:\n\n' "$C_CYAN" "$C_RESET" "$C_CYAN" "$C_RESET"
    printf '      %sexport PATH="%s:$PATH"%s\n\n' "$C_BOLD" "$BIN_DIR" "$C_RESET"
    printf '    Then reload your shell, or run the CLI directly:\n\n'
    printf '      %s%s --help%s\n' "$C_BOLD" "$LINK_PATH" "$C_RESET"
    ;;
esac
printf '\n'

# ── verify ───────────────────────────────────────────────────────────────────
if [ "$DRY_RUN" != "1" ]; then
  installed_version=$("$LINK_PATH" --version 2>/dev/null || true)
  if [ -n "$installed_version" ]; then
    ok "human-feedback v$installed_version installed"
  else
    warn "could not run 'human-feedback --version' (binary may still need PATH setup)"
  fi
fi
printf '\n'

# ── next steps ───────────────────────────────────────────────────────────────
printf '  %sNext steps:%s\n\n' "$C_BOLD" "$C_RESET"
printf '    Install the %s/human-feedback%s command into your agent harness:\n\n' "$C_CYAN" "$C_RESET"
printf '      %shuman-feedback install%s             %s# interactive%s\n'   "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
printf '      %shuman-feedback install --claude-code%s\n' "$C_BOLD" "$C_RESET"
printf '      %shuman-feedback install --cursor%s\n'      "$C_BOLD" "$C_RESET"
printf '      %shuman-feedback install --codex%s\n'       "$C_BOLD" "$C_RESET"
printf '      %shuman-feedback install --hermes%s\n\n'    "$C_BOLD" "$C_RESET"
printf '    To update later:                   %shuman-feedback update%s\n'             "$C_BOLD" "$C_RESET"
printf '    To check for a new version:        %shuman-feedback check-for-updates%s\n\n' "$C_BOLD" "$C_RESET"
