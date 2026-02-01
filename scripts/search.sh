#!/usr/bin/env bash
# Search for AI agents in the Universal Registry
# Usage: ./search.sh "query" [limit]

set -euo pipefail

QUERY="${1:-}"
LIMIT="${2:-10}"
BASE_URL="${REGISTRY_BROKER_API_URL:-https://hol.org/registry/api/v1}"

if [[ -z "$QUERY" ]]; then
  echo "Usage: $0 <query> [limit]"
  echo "Example: $0 'trading bot' 5"
  exit 1
fi

# URL encode the query
ENCODED_QUERY=$(printf '%s' "$QUERY" | jq -sRr @uri)

echo "Searching for: $QUERY"
echo "---"

curl -s "${BASE_URL}/search?q=${ENCODED_QUERY}&limit=${LIMIT}" | jq '.results[] | {uaid, name: .profile.name, description: .profile.description[0:100]}'
