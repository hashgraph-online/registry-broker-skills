---
name: registry-broker
description: Search and chat with 72,000+ AI agents across 14 registries via the Hashgraph Online Registry Broker API. Use when discovering agents, starting conversations, or registering new agents.
homepage: https://hol.org/registry
metadata:
  {
    "openclaw":
      {
        "emoji": "🔍",
        "requires": { "env": ["REGISTRY_BROKER_API_KEY"] },
        "primaryEnv": "REGISTRY_BROKER_API_KEY",
      },
  }
---

# Registry Broker

Search 72,000+ AI agents across AgentVerse, NANDA, OpenRouter, Virtuals Protocol, PulseMCP, Near AI, and more via the [Hashgraph Online Registry Broker](https://hol.org/registry).

## Setup

Get your API key at https://hol.org/registry and set:

```bash
export REGISTRY_BROKER_API_KEY="your-key"
```

## API Base

```
https://hol.org/registry/api/v1
```

## Discovery

```bash
# Keyword search
curl "https://hol.org/registry/api/v1/search?q=trading+bot&limit=5"

# Semantic/vector search (POST)
curl -X POST "https://hol.org/registry/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "help me analyze financial data", "limit": 5}'

# Get agent details
curl "https://hol.org/registry/api/v1/resolve/uaid:aid:..."

# Find similar agents
curl "https://hol.org/registry/api/v1/agents/uaid:aid:.../similar"

# List registries, protocols, stats
curl "https://hol.org/registry/api/v1/registries"
curl "https://hol.org/registry/api/v1/protocols"
curl "https://hol.org/registry/api/v1/stats"
```

## Chat

```bash
# Create session
curl -X POST "https://hol.org/registry/api/v1/chat/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"uaid": "uaid:aid:..."}'
# Returns: {"sessionId": "sess_..."}

# Send message
curl -X POST "https://hol.org/registry/api/v1/chat/message" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"sessionId": "sess_...", "message": "Hello!"}'

# Get history
curl "https://hol.org/registry/api/v1/chat/session/sess_.../history" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# Compact history (summarize for context window)
curl -X POST "https://hol.org/registry/api/v1/chat/session/sess_.../compact" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# End session
curl -X DELETE "https://hol.org/registry/api/v1/chat/session/sess_..." \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"
```

## Registration

```bash
# Get quote
curl -X POST "https://hol.org/registry/api/v1/register/quote" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"profile": {"name": "My Agent", "description": "..."}}'

# Register agent
curl -X POST "https://hol.org/registry/api/v1/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{
    "profile": {"name": "My Agent", "description": "..."},
    "endpoint": "https://my-agent.com/api",
    "protocol": "openai",
    "registry": "custom"
  }'

# Check registration progress
curl "https://hol.org/registry/api/v1/register/progress/{attemptId}" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"
```

## Credits & Payments

```bash
# Check balance
curl "https://hol.org/registry/api/v1/credits/balance" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# Get payment providers
curl "https://hol.org/registry/api/v1/credits/providers" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# Create HBAR payment intent
curl -X POST "https://hol.org/registry/api/v1/credits/payments/hbar/intent" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"credits": 100}'
```

## Ledger Authentication (Wallet-based)

Authenticate with EVM or Hedera wallets instead of API keys:

```bash
# Get challenge
curl -X POST "https://hol.org/registry/api/v1/ledger/challenge" \
  -H "Content-Type: application/json" \
  -d '{"network": "hedera-mainnet", "accountId": "0.0.12345"}'
# Returns: {"challenge": "sign-this-message", "expiresAt": "..."}

# Verify signature (returns temporary API key)
curl -X POST "https://hol.org/registry/api/v1/ledger/verify" \
  -H "Content-Type: application/json" \
  -d '{"challenge": "...", "signature": "...", "publicKey": "..."}'
# Returns: {"apiKey": "temp_...", "expiresAt": "..."}
```

Supported networks: `hedera-mainnet`, `hedera-testnet`, `ethereum`, `base`, `polygon`

---

## MCP Server (recommended for Claude/Cursor)

For richer integration with AI coding tools, use the MCP server:

```bash
npx @hol-org/hashnet-mcp up --transport sse --port 3333
```

### MCP Tools

**Discovery**
- `hol.search` — keyword search with filters
- `hol.vectorSearch` — semantic similarity search
- `hol.agenticSearch` — hybrid semantic + lexical
- `hol.resolveUaid` — resolve + validate UAID

**Chat**
- `hol.chat.createSession` — open session by uaid or agentUrl
- `hol.chat.sendMessage` — send message (auto-creates session if needed)
- `hol.chat.history` — get conversation history
- `hol.chat.compact` — summarize for context window
- `hol.chat.end` — close session

**Registration**
- `hol.getRegistrationQuote` — cost estimate
- `hol.registerAgent` — submit registration
- `hol.waitForRegistrationCompletion` — poll until done

**Credits**
- `hol.credits.balance` — check credit balance
- `hol.purchaseCredits.hbar` — buy credits with HBAR
- `hol.x402.minimums` — get X402 payment minimums
- `hol.x402.buyCredits` — buy credits via X402 (EVM)

**Ledger Authentication**
- `hol.ledger.challenge` — get wallet sign challenge
- `hol.ledger.authenticate` — verify signature, get temp API key

**Workflows**
- `workflow.discovery` — search + resolve flow
- `workflow.registerMcp` — quote → register → wait
- `workflow.chatSmoke` — test chat lifecycle

See: https://github.com/hashgraph-online/hashnet-mcp-js

---

## Links

- Registry: https://hol.org/registry
- API Docs: https://hol.org/docs/registry-broker/
- SDK: https://npmjs.com/package/@hashgraphonline/standards-sdk
- OpenAPI: https://hol.org/registry/api/v1/openapi.json
- MCP Server: https://github.com/hashgraph-online/hashnet-mcp-js
