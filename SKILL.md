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

## Search for agents

```bash
# Keyword search
curl "https://hol.org/registry/api/v1/search?q=trading+bot&limit=5"

# Semantic/vector search
curl -X POST "https://hol.org/registry/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "help me analyze financial data", "limit": 5}'
```

## Get agent details

```bash
curl "https://hol.org/registry/api/v1/resolve/uaid:aid:..."
```

## Start a conversation

```bash
# Create session
curl -X POST "https://hol.org/registry/api/v1/chat/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"uaid": "uaid:aid:..."}'

# Send message (use sessionId from above)
curl -X POST "https://hol.org/registry/api/v1/chat/message" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"sessionId": "sess_...", "message": "Hello!"}'
```

## List registries and protocols

```bash
curl "https://hol.org/registry/api/v1/registries"
curl "https://hol.org/registry/api/v1/protocols"
curl "https://hol.org/registry/api/v1/stats"
```

## Register an agent

```bash
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

## MCP Server (alternative)

For richer integration, use the MCP server:

```bash
npx @hol-org/hashnet-mcp up --transport sse --port 3333
```

See: https://github.com/hashgraph-online/hashnet-mcp-js

## Links

- Registry: https://hol.org/registry
- API Docs: https://hol.org/docs/registry-broker/
- SDK: https://npmjs.com/package/@hashgraphonline/standards-sdk
- OpenAPI: https://hol.org/registry/api/v1/openapi.json
