#!/usr/bin/env bash
# Install or remove macOS launchd job for daily WeRead sync.
set -euo pipefail

LABEL="com.reading-records.weread-sync"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SYNC_SCRIPT="$ROOT/scripts/sync-weread-daily.sh"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/common.sh"

usage() {
  echo "Usage: $0 [install|uninstall|status]"
  echo "  install   — run sync every day at 08:00 (local time)"
  echo "  uninstall — remove scheduled job"
  echo "  status    — show whether the job is loaded"
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
    <string>${SYNC_SCRIPT}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>8</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${ROOT}/logs/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${ROOT}/logs/launchd.err.log</string>
</dict>
</plist>
EOF
}

hint_node_bin() {
  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT/.env"
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
    chmod +x "$SYNC_SCRIPT"
    if [[ ! -f "$ROOT/.env" ]]; then
      echo "Tip: copy .env.example to .env and set WEREAD_API_KEY before the first run."
    fi
    write_plist
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
    echo "Installed. Sync runs daily at 08:00."
    echo "Plist: $PLIST_DEST"
    echo "Logs:  $ROOT/logs/sync-weread.log"
    echo ""
    hint_node_bin || true
    echo ""
    echo "Test now: $SYNC_SCRIPT"
    ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
    rm -f "$PLIST_DEST"
    echo "Removed daily sync job."
    ;;
  status)
    if launchctl print "gui/$(id -u)/${LABEL}" &>/dev/null; then
      echo "Loaded: ${LABEL}"
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
