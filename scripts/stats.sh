#!/usr/bin/env bash
# Get platform statistics
# Usage: ./stats.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="${SCRIPT_DIR}/../bin/cli.js"

run_cli() {
  if [[ -f "$CLI_PATH" ]]; then
    node "$CLI_PATH" "$@"
    return
  fi

  if command -v pnpm >/dev/null 2>&1; then
    (cd "${SCRIPT_DIR}/.." && pnpm run build >/dev/null 2>&1)
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

run_stats() {
  run_cli stats
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  run_stats
fi
