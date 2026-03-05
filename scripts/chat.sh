#!/usr/bin/env bash
# Start a chat session with an agent
# Usage: ./chat.sh <uaid> <message>

set -euo pipefail

UAID="${1:-}"
MESSAGE="${2:-Hello!}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/stats.sh"

if [[ -z "$UAID" ]]; then
  echo "Usage: $0 <uaid> [message]"
  echo "Example: $0 'uaid:aid:fetchai:agent123' 'Hello!'"
  exit 1
fi

run_cli chat "$UAID" "$MESSAGE"
