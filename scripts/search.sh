#!/usr/bin/env bash
# Search for AI agents in the Universal Registry
# Usage: ./search.sh "query" [limit]

set -euo pipefail

QUERY="${1:-}"
LIMIT="${2:-10}"
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

if [[ -z "$QUERY" ]]; then
  echo "Usage: $0 <query> [limit]"
  echo "Example: $0 'trading bot' 5"
  exit 1
fi

run_cli search "$QUERY" "$LIMIT"
