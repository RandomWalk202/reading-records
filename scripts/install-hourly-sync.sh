#!/usr/bin/env bash
# Install or remove macOS launchd job for hourly reading duration recording.
set -euo pipefail

LABEL="com.reading-records.weread-hourly"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPPORT_DIR="$HOME/Library/Application Support/reading-records"
RUNNER_SCRIPT="$SUPPORT_DIR/run-hourly-record.sh"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/common.sh"

usage() {
  echo "Usage: $0 [install|uninstall|status]"
  echo "  install   — record reading duration every hour on the hour (local time)"
  echo "  uninstall — remove scheduled job"
  echo "  status    — show whether the job is loaded"
}

deploy_runner() {
  mkdir -p "$SUPPORT_DIR/logs" "$SUPPORT_DIR/lib" "$SUPPORT_DIR/scripts/lib"
  cp "$ROOT/scripts/record-reading-hour.mjs" "$SUPPORT_DIR/record-reading-hour.mjs"
  cp "$ROOT/scripts/lib/record-hourly-reading.mjs" "$SUPPORT_DIR/scripts/lib/record-hourly-reading.mjs"
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
LOG_FILE="$LOG_DIR/record-reading-hour.log"

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
  log "ERROR: WEREAD_API_KEY is not set. Add it to $SUPPORT_DIR/.env"
  exit 1
fi

NODE_BIN="$(resolve_node_bin || true)"
if [[ -z "$NODE_BIN" ]]; then
  log "ERROR: node not found. Set NODE_BIN=/full/path/to/node in $SUPPORT_DIR/.env"
  exit 1
fi

{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') node=$NODE_BIN ====="
  "$NODE_BIN" "$SUPPORT_DIR/record-reading-hour.mjs"
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
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${SUPPORT_DIR}/logs/launchd-hourly.out.log</string>
  <key>StandardErrorPath</key>
  <string>${SUPPORT_DIR}/logs/launchd-hourly.err.log</string>
</dict>
</plist>
EOF
}

cmd="${1:-install}"

case "$cmd" in
  install)
    deploy_runner
    write_plist
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
    echo "Installed. Records reading every hour at :00 (local time)."
    echo "Plist: $PLIST_DEST"
    echo "Runner: $RUNNER_SCRIPT"
    echo "Logs: $SUPPORT_DIR/logs/record-reading-hour.log"
    echo "Test now: $RUNNER_SCRIPT"
    ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    rm -f "$PLIST_DEST"
    echo "Removed hourly recording job."
    ;;
  status)
    if launchctl print "gui/$(id -u)/${LABEL}" &>/dev/null; then
      echo "Loaded: ${LABEL}"
      echo "Runner: $RUNNER_SCRIPT"
    else
      echo "Not loaded: ${LABEL}"
    fi
    ;;
  *)
    usage
    exit 1
    ;;
esac
