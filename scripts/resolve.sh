#!/usr/bin/env bash
# Resolve a UAID to get full agent details
# Usage: ./resolve.sh <uaid>

set -euo pipefail

UAID="${1:-}"
BASE_URL="${REGISTRY_BROKER_API_URL:-https://hol.org/registry/api/v1}"

if [[ -z "$UAID" ]]; then
  echo "Usage: $0 <uaid>"
  echo "Example: $0 'uaid:aid:fetchai:agent123'"
  exit 1
fi

echo "Resolving: $UAID"
echo "---"

curl -s "${BASE_URL}/resolve/${UAID}" | jq .
