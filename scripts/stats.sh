#!/usr/bin/env bash
# Get platform statistics
# Usage: ./stats.sh

set -euo pipefail

BASE_URL="${REGISTRY_BROKER_API_URL:-https://hol.org/registry/api/v1}"

echo "Registry Statistics"
echo "==================="

curl -s "${BASE_URL}/stats" | jq .

echo ""
echo "Available Registries"
echo "===================="

curl -s "${BASE_URL}/registries" | jq '.registries[]'
