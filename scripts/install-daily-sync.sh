#!/usr/bin/env bash
# Install or remove macOS launchd job for daily WeRead sync.
set -euo pipefail

LABEL="com.reading-records.weread-sync"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPPORT_DIR="$HOME/Library/Application Support/reading-records"
RUNNER_SCRIPT="$SUPPORT_DIR/run-daily-sync.sh"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/common.sh"

usage() {
  echo "Usage: $0 [install|uninstall|status]"
  echo "  install   — run sync every day at 10:00 (local time)"
  echo "  uninstall — remove scheduled job"
  echo "  status    — show whether the job is loaded"
}

deploy_runner() {
  mkdir -p "$SUPPORT_DIR/logs" "$SUPPORT_DIR/lib"
  cp "$ROOT/scripts/sync-weread.mjs" "$SUPPORT_DIR/sync-weread.mjs"
  cp "$ROOT/scripts/lib/common.sh" "$SUPPORT_DIR/lib/common.sh"

  if [[ -f "$ROOT/.env" ]]; then
    cp "$ROOT/.env" "$SUPPORT_DIR/.env"
  elif [[ ! -f "$SUPPORT_DIR/.env" ]]; then
    echo "Warning: $ROOT/.env not found. Create it before the first scheduled run."
  fi

  cat >"$RUNNER_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SUPPORT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SUPPORT_DIR/logs"
LOG_FILE="$LOG_DIR/sync-weread.log"

# shellcheck disable=SC1091
source "$SUPPORT_DIR/lib/common.sh"

mkdir -p "$LOG_DIR"

if [[ -f "$SUPPORT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SUPPORT_DIR/.env"
  set +a
fi

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >>"$LOG_FILE"
}

if [[ -z "${WEREAD_API_KEY:-}" ]]; then
  log "ERROR: WEREAD_API_KEY is not set. Add it to $SUPPORT_DIR/.env (re-run install after editing project .env)"
  exit 1
fi

NODE_BIN="$(resolve_node_bin || true)"
if [[ -z "$NODE_BIN" ]]; then
  log "ERROR: node not found. Set NODE_BIN=/full/path/to/node in $SUPPORT_DIR/.env"
  exit 1
fi

{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') node=$NODE_BIN ====="
  "$NODE_BIN" "$SUPPORT_DIR/sync-weread.mjs"
} >>"$LOG_FILE" 2>&1
EOF

  chmod +x "$RUNNER_SCRIPT"
}

write_plist() {
  cat >"$PLIST_DEST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${RUNNER_SCRIPT}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>WorkingDirectory</key>
  <string>${SUPPORT_DIR}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>10</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${SUPPORT_DIR}/logs/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${SUPPORT_DIR}/logs/launchd.err.log</string>
</dict>
</plist>
EOF
}

hint_node_bin() {
  local env_file="$ROOT/.env"
  if [[ -f "$SUPPORT_DIR/.env" ]]; then
    env_file="$SUPPORT_DIR/.env"
  fi

  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$env_file"
    set +a
  fi

  local node_path
  node_path="$(resolve_node_bin || true)"
  if [[ -n "$node_path" ]]; then
    echo "Detected node: $node_path"
    if [[ -z "${NODE_BIN:-}" ]]; then
      echo "Add to .env (recommended for daily auto-sync):"
      echo "NODE_BIN=$node_path"
    fi
    return 0
  fi

  echo "node not found yet. After installing Node, or if you use conda/nvm, run:"
  echo "  which node"
  echo "Then add to .env:"
  echo "  NODE_BIN=/full/path/from/which/node"
  return 1
}

cmd="${1:-install}"

case "$cmd" in
  install)
    if [[ ! -f "$ROOT/.env" ]]; then
      echo "Tip: copy .env.example to .env and set WEREAD_API_KEY before the first run."
    fi
    deploy_runner
    write_plist
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
    echo "Installed. Sync runs daily at 10:00."
    echo "Plist: $PLIST_DEST"
    echo "Runner: $RUNNER_SCRIPT"
    echo "Logs (launchd): $SUPPORT_DIR/logs/"
    echo "Tip: after editing project .env, run install again to refresh the copy."
    if [[ "$ROOT" == *"/Desktop/"* ]]; then
      echo "Note: project is on Desktop; launchd uses Application Support to avoid macOS privacy blocks."
    fi
    echo ""
    hint_node_bin || true
    echo ""
    echo "Test now: $RUNNER_SCRIPT"
    ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    rm -f "$PLIST_DEST"
    echo "Removed daily sync job."
    ;;
  status)
    if launchctl print "gui/$(id -u)/${LABEL}" &>/dev/null; then
      echo "Loaded: ${LABEL}"
      echo "Runner: $RUNNER_SCRIPT"
      echo "Logs:   $SUPPORT_DIR/logs/"
    else
      echo "Not loaded: ${LABEL}"
    fi
    hint_node_bin || true
    ;;
  *)
    usage
    exit 1
    ;;
esac
