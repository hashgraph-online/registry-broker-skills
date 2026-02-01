#!/usr/bin/env bash
# Check credit balance
# Usage: ./balance.sh

set -euo pipefail

BASE_URL="${REGISTRY_BROKER_API_URL:-https://hol.org/registry/api/v1}"
API_KEY="${REGISTRY_BROKER_API_KEY:-}"

if [[ -z "$API_KEY" ]]; then
  echo "Error: REGISTRY_BROKER_API_KEY environment variable is required"
  exit 1
fi

echo "Credit Balance"
echo "=============="

curl -s "${BASE_URL}/credits/balance" \
  -H "x-api-key: $API_KEY" | jq .
