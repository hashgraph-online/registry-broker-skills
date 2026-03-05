#!/usr/bin/env bash
# Search for AI agents in the Universal Registry
# Usage: ./search.sh "query" [limit]

set -euo pipefail

QUERY="${1:-}"
LIMIT="${2:-10}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/stats.sh"

if [[ -z "$QUERY" ]]; then
  echo "Usage: $0 <query> [limit]"
  echo "Example: $0 'trading bot' 5"
  exit 1
fi

run_cli search "$QUERY" "$LIMIT"
