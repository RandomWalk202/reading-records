# Shared helpers for sync shell scripts.

resolve_node_bin() {
  if [[ -n "${NODE_BIN:-}" && -x "${NODE_BIN}" ]]; then
    echo "$NODE_BIN"
    return 0
  fi

  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  local candidate
  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "$HOME/.fnm/current/bin/node" \
    "$HOME/miniconda3/bin/node" \
    "$HOME/anaconda3/bin/node" \
    /opt/miniconda3/bin/node; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  for candidate in "$HOME"/.nvm/versions/node/*/bin/node; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  if [[ -n "${CONDA_PREFIX:-}" && -x "${CONDA_PREFIX}/bin/node" ]]; then
    echo "${CONDA_PREFIX}/bin/node"
    return 0
  fi

  return 1
}
