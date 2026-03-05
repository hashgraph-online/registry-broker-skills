#!/usr/bin/env bash
# Resolve a UAID to get full agent details
# Usage: ./resolve.sh <uaid>

set -euo pipefail

UAID="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/stats.sh"

if [[ -z "$UAID" ]]; then
  echo "Usage: $0 <uaid>"
  echo "Example: $0 'uaid:aid:fetchai:agent123'"
  exit 1
fi

run_cli resolve "$UAID"
