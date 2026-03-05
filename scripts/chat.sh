#!/usr/bin/env bash
# Start a chat session with an agent
# Usage: ./chat.sh <uaid> <message>

set -euo pipefail

UAID="${1:-}"
MESSAGE="${2:-Hello!}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="${SCRIPT_DIR}/../bin/cli.js"

run_cli() {
  if [[ -f "$CLI_PATH" ]]; then
    node "$CLI_PATH" "$@"
    return
  fi

  if command -v pnpm >/dev/null 2>&1; then
    (cd "${SCRIPT_DIR}/.." && pnpm run build >/dev/null 2>&1 || true)
  fi

  if [[ -f "$CLI_PATH" ]]; then
    node "$CLI_PATH" "$@"
    return
  fi

  if command -v hol-registry >/dev/null 2>&1; then
    hol-registry "$@"
    return
  fi

  echo "Error: CLI is not available. Install with 'npm i -g @hol-org/registry' or run 'pnpm run build'."
  exit 1
}

if [[ -z "$UAID" ]]; then
  echo "Usage: $0 <uaid> [message]"
  echo "Example: $0 'uaid:aid:fetchai:agent123' 'Hello!'"
  exit 1
fi

run_cli chat "$UAID" "$MESSAGE"
