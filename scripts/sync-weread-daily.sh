#!/usr/bin/env bash
# Daily WeRead → Supabase sync. Used by launchd or manual runs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/common.sh"

LOG_DIR="$ROOT/logs"
LOG_FILE="$LOG_DIR/sync-weread.log"
mkdir -p "$LOG_DIR"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >>"$LOG_FILE"
}

if [[ -z "${WEREAD_API_KEY:-}" ]]; then
  log "ERROR: WEREAD_API_KEY is not set. Add it to $ROOT/.env"
  exit 1
fi

NODE_BIN="$(resolve_node_bin || true)"
if [[ -z "$NODE_BIN" ]]; then
  log "ERROR: node not found. Install Node.js or set NODE_BIN=/full/path/to/node in .env"
  exit 1
fi

{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') node=$NODE_BIN ====="
  "$NODE_BIN" "$ROOT/scripts/sync-weread.mjs"
} >>"$LOG_FILE" 2>&1
