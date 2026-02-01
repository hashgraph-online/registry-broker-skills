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

### Keyword Search

```bash
# GET /search with query params
curl "https://hol.org/registry/api/v1/search?q=trading+bot&limit=5"

# With filters: registries, adapters, capabilities, protocols, minTrust, verified, online, sortBy, type
curl "https://hol.org/registry/api/v1/search?q=defi&registries=agentverse,nanda&verified=true&limit=10"
```

### Vector/Semantic Search

```bash
# POST /search with JSON body
curl -X POST "https://hol.org/registry/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "help me analyze financial data", "limit": 5}'
```

### Capability Search

```bash
# POST /search/capabilities
curl -X POST "https://hol.org/registry/api/v1/search/capabilities" \
  -H "Content-Type: application/json" \
  -d '{"capabilities": ["code-generation", "data-analysis"], "limit": 10}'
```

### Agent Details

```bash
# GET /agents/{uaid} - Get agent details
curl "https://hol.org/registry/api/v1/agents/uaid:aid:fetchai:..."

# GET /agents/{uaid}/similar - Find similar agents
curl "https://hol.org/registry/api/v1/agents/uaid:aid:fetchai:.../similar"

# GET /agents/{uaid}/feedback - Get agent feedback
curl "https://hol.org/registry/api/v1/agents/uaid:aid:fetchai:.../feedback"
```

### Routing & Resolution

```bash
# GET /resolve/{uaid} - Resolve UAID to agent metadata
curl "https://hol.org/registry/api/v1/resolve/uaid:aid:fetchai:..."

# GET /uaids/validate/{uaid} - Validate UAID format
curl "https://hol.org/registry/api/v1/uaids/validate/uaid:aid:fetchai:..."

# GET /uaids/connections/{uaid}/status - Check connection status
curl "https://hol.org/registry/api/v1/uaids/connections/uaid:aid:.../status"
```

### Registry Information

```bash
# GET /registries - List known registries
curl "https://hol.org/registry/api/v1/registries"

# GET /adapters - List available adapters
curl "https://hol.org/registry/api/v1/adapters"

# GET /adapters/details - Adapter metadata with chat capabilities
curl "https://hol.org/registry/api/v1/adapters/details"

# GET /stats - Platform statistics
curl "https://hol.org/registry/api/v1/stats"

# GET /providers - Provider catalog with protocols
curl "https://hol.org/registry/api/v1/providers"

# GET /popular - Popular search queries
curl "https://hol.org/registry/api/v1/popular"

# GET /search/facets - Available search facets
curl "https://hol.org/registry/api/v1/search/facets"

# GET /search/status - Search backend status
curl "https://hol.org/registry/api/v1/search/status"
```

## Chat

### Session Management

```bash
# POST /chat/session - Create session (by UAID or agentUrl)
curl -X POST "https://hol.org/registry/api/v1/chat/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"uaid": "uaid:aid:fetchai:..."}'

# Or by agent URL:
curl -X POST "https://hol.org/registry/api/v1/chat/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"agentUrl": "https://agent.example.com/api"}'
# Returns: {"sessionId": "sess_..."}
```

### Messaging

```bash
# POST /chat/message - Send message
curl -X POST "https://hol.org/registry/api/v1/chat/message" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"sessionId": "sess_...", "message": "Hello!"}'

# With streaming (SSE):
curl -X POST "https://hol.org/registry/api/v1/chat/message" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"sessionId": "sess_...", "message": "Hello!", "stream": true}'
```

### History & Management

```bash
# GET /chat/session/{sessionId}/history - Get conversation history
curl "https://hol.org/registry/api/v1/chat/session/sess_.../history" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# POST /chat/session/{sessionId}/compact - Summarize history (debits credits)
curl -X POST "https://hol.org/registry/api/v1/chat/session/sess_.../compact" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# GET /chat/session/{sessionId}/encryption - Get encryption status
curl "https://hol.org/registry/api/v1/chat/session/sess_.../encryption" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# DELETE /chat/session/{sessionId} - End session
curl -X DELETE "https://hol.org/registry/api/v1/chat/session/sess_..." \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"
```

## Registration

### Quote & Register

```bash
# GET /register/additional-registries - List available registries for registration
curl "https://hol.org/registry/api/v1/register/additional-registries" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# POST /register/quote - Get credit cost estimate
curl -X POST "https://hol.org/registry/api/v1/register/quote" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"profile": {"name": "My Agent", "description": "..."}}'

# POST /register - Register agent (returns 200/202/207)
curl -X POST "https://hol.org/registry/api/v1/register" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{
    "profile": {"name": "My Agent", "description": "..."},
    "endpoint": "https://my-agent.com/api",
    "protocol": "openai",
    "registry": "custom"
  }'
```

### Status & Updates

```bash
# GET /register/status/{uaid} - Check registration status
curl "https://hol.org/registry/api/v1/register/status/uaid:..." \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# GET /register/progress/{attemptId} - Poll registration progress
curl "https://hol.org/registry/api/v1/register/progress/{attemptId}" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# PUT /register/{uaid} - Update agent
curl -X PUT "https://hol.org/registry/api/v1/register/uaid:..." \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"profile": {"name": "Updated Name"}}'

# DELETE /register/{uaid} - Unregister agent
curl -X DELETE "https://hol.org/registry/api/v1/register/uaid:..." \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"
```

## Credits & Payments

```bash
# GET /credits/balance - Check balance (optional accountId query param)
curl "https://hol.org/registry/api/v1/credits/balance" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# GET /credits/providers - List payment providers
curl "https://hol.org/registry/api/v1/credits/providers" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# POST /credits/payments/hbar/intent - Create HBAR payment intent
curl -X POST "https://hol.org/registry/api/v1/credits/payments/hbar/intent" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"credits": 100}'

# POST /credits/payments/intent - Create Stripe payment intent
curl -X POST "https://hol.org/registry/api/v1/credits/payments/intent" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"credits": 100}'
```

## Ledger Authentication (Wallet-based)

Authenticate with EVM or Hedera wallets instead of API keys:

```bash
# POST /auth/ledger/challenge - Get sign challenge
curl -X POST "https://hol.org/registry/api/v1/auth/ledger/challenge" \
  -H "Content-Type: application/json" \
  -d '{"network": "hedera-mainnet", "accountId": "0.0.12345"}'
# Returns: {"challengeId": "...", "challenge": "sign-this-message", "expiresAt": "..."}

# POST /auth/ledger/verify - Verify signature, get temp API key
curl -X POST "https://hol.org/registry/api/v1/auth/ledger/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "...",
    "accountId": "0.0.12345",
    "network": "hedera-mainnet",
    "signature": "...",
    "publicKey": "...",
    "signatureKind": "raw"
  }'
# Returns: {"apiKey": {...}, "expiresAt": "..."}
```

Supported networks: `hedera-mainnet`, `hedera-testnet`, `ethereum`, `base`, `polygon`

Signature kinds: `raw`, `map`, `evm`

## Encryption Keys

```bash
# POST /encryption/keys - Register long-term encryption key
curl -X POST "https://hol.org/registry/api/v1/encryption/keys" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"publicKey": "...", "uaid": "uaid:..."}'
```

## Content Inscription (HCS)

```bash
# GET /inscribe/content/config - Get inscription service config
curl "https://hol.org/registry/api/v1/inscribe/content/config" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# POST /inscribe/content/quote - Get cost quote
curl -X POST "https://hol.org/registry/api/v1/inscribe/content/quote" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"content": "base64...", "mimeType": "text/plain"}'

# POST /inscribe/content - Create inscription job
curl -X POST "https://hol.org/registry/api/v1/inscribe/content" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"content": "base64...", "mimeType": "text/plain", "quoteId": "..."}'

# GET /inscribe/content/{jobId} - Check job status
curl "https://hol.org/registry/api/v1/inscribe/content/{jobId}" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"

# GET /inscribe/content - List user inscriptions
curl "https://hol.org/registry/api/v1/inscribe/content?limit=20" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"
```

## Routing (Advanced)

```bash
# POST /route/{uaid} - Send routed message to agent
curl -X POST "https://hol.org/registry/api/v1/route/uaid:..." \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"message": "Hello", "metadata": {}}'

# DELETE /uaids/connections/{uaid} - Close active connection
curl -X DELETE "https://hol.org/registry/api/v1/uaids/connections/uaid:..." \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY"
```

---

## MCP Server (recommended for Claude/Cursor)

For richer integration with AI coding tools, use the MCP server:

```bash
npx @hol-org/hashnet-mcp up --transport sse --port 3333
```

### MCP Tools

**Discovery**
- `hol.search` - keyword search with filters
- `hol.vectorSearch` - semantic similarity search
- `hol.agenticSearch` - hybrid semantic + lexical
- `hol.resolveUaid` - resolve + validate UAID

**Chat**
- `hol.chat.createSession` - open session by uaid or agentUrl
- `hol.chat.sendMessage` - send message (auto-creates session if needed)
- `hol.chat.history` - get conversation history
- `hol.chat.compact` - summarize for context window
- `hol.chat.end` - close session

**Registration**
- `hol.getRegistrationQuote` - cost estimate
- `hol.registerAgent` - submit registration
- `hol.waitForRegistrationCompletion` - poll until done

**Credits**
- `hol.credits.balance` - check credit balance
- `hol.purchaseCredits.hbar` - buy credits with HBAR
- `hol.x402.minimums` - get X402 payment minimums
- `hol.x402.buyCredits` - buy credits via X402 (EVM)

**Ledger Authentication**
- `hol.ledger.challenge` - get wallet sign challenge
- `hol.ledger.authenticate` - verify signature, get temp API key

**Workflows**
- `workflow.discovery` - search + resolve flow
- `workflow.registerMcp` - quote + register + wait
- `workflow.chatSmoke` - test chat lifecycle

See: https://github.com/hashgraph-online/hashnet-mcp-js

---

## Links

- Registry: https://hol.org/registry
- API Docs: https://hol.org/docs/registry-broker/
- SDK: https://npmjs.com/package/@hashgraphonline/standards-sdk
- OpenAPI: https://hol.org/registry/api/v1/openapi.json
- MCP Server: https://github.com/hashgraph-online/hashnet-mcp-js
