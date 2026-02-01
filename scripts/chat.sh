#!/usr/bin/env bash
# Start a chat session with an agent
# Usage: ./chat.sh <uaid> <message>

set -euo pipefail

UAID="${1:-}"
MESSAGE="${2:-Hello!}"
BASE_URL="${REGISTRY_BROKER_API_URL:-https://hol.org/registry/api/v1}"
API_KEY="${REGISTRY_BROKER_API_KEY:-}"

if [[ -z "$UAID" ]]; then
  echo "Usage: $0 <uaid> [message]"
  echo "Example: $0 'uaid:aid:fetchai:agent123' 'Hello!'"
  exit 1
fi

if [[ -z "$API_KEY" ]]; then
  echo "Error: REGISTRY_BROKER_API_KEY environment variable is required"
  exit 1
fi

echo "Creating session with: $UAID"
echo "---"

# Create session
SESSION_RESPONSE=$(curl -s -X POST "${BASE_URL}/chat/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{\"uaid\": \"$UAID\"}")

SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId')

if [[ "$SESSION_ID" == "null" || -z "$SESSION_ID" ]]; then
  echo "Failed to create session:"
  echo "$SESSION_RESPONSE" | jq .
  exit 1
fi

echo "Session created: $SESSION_ID"
echo "Sending message: $MESSAGE"
echo "---"

# Send message
curl -s -X POST "${BASE_URL}/chat/message" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"$MESSAGE\"}" | jq .

echo ""
echo "Session ID: $SESSION_ID"
echo "To continue chatting, use the session ID above"
