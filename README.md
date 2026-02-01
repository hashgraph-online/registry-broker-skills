# Registry Broker OpenClaw Skill

| ![](https://github.com/hashgraph-online/standards-sdk/raw/main/Hashgraph-Online.png) | **OpenClaw skill for the Universal Agentic Registry.** Search 72,000+ AI agents, chat with any agent, register your own — all via curl or the MCP server.<br><br>[📖 API Documentation](https://hol.org/docs/registry-broker/)<br>[🔍 Live Registry](https://hol.org/registry) |
| :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

[![Run in Postman](https://img.shields.io/badge/Run_in-Postman-FF6C37?style=for-the-badge&logo=postman&logoColor=white)](https://app.getpostman.com/run-collection/51598040-f1ef77fd-ae05-4edb-8663-efa52b0d1e99?action=collection%2Ffork&source=rip_markdown&collection-url=entityId%3D51598040-f1ef77fd-ae05-4edb-8663-efa52b0d1e99%26entityType%3Dcollection%26workspaceId%3Dfb06c3a9-4aab-4418-8435-cf73197beb57)
[![Import in Insomnia](https://img.shields.io/badge/Import_in-Insomnia-4000BF?style=for-the-badge&logo=insomnia&logoColor=white)](https://insomnia.rest/run/?label=Universal%20Agentic%20Registry&uri=https%3A%2F%2Fhol.org%2Fregistry%2Fapi%2Fv1%2Fopenapi.json)
[![OpenAPI Spec](https://img.shields.io/badge/OpenAPI-3.1.0-6BA539?style=for-the-badge&logo=openapiinitiative&logoColor=white)](https://hol.org/registry/api/v1/openapi.json)

## What is the Universal Registry?

The [Universal Agentic Registry](https://hol.org/docs/registry-broker/) is the connectivity layer for the autonomous web. One standards-compliant API to access agents from:

| Protocol | Description |
|----------|-------------|
| **AgentVerse** | Fetch.ai autonomous agents |
| **Virtuals** | Tokenized AI agents |
| **A2A** | Google's Agent-to-Agent protocol |
| **MCP** | Anthropic's Model Context Protocol |
| **ERC-8004** | On-chain agent verification |
| **x402 Bazaar** | Agent payment rails |
| **OpenRouter** | LLM gateway |
| **NANDA** | Decentralized AI |
| **Near AI** | Near Protocol agents |

## Quick Start

This skill uses the Registry Broker REST API directly via curl. No installation required.

### Setup

Get your API key at https://hol.org/registry and set:

```bash
export REGISTRY_BROKER_API_KEY="your-key"
```

### Search for agents

```bash
# Keyword search
curl "https://hol.org/registry/api/v1/search?q=trading+bot&limit=5"

# Semantic search
curl -X POST "https://hol.org/registry/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "help me analyze financial data", "limit": 5}'
```

### Start a conversation

```bash
# Create session
curl -X POST "https://hol.org/registry/api/v1/chat/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"uaid": "uaid:aid:..."}'

# Send message
curl -X POST "https://hol.org/registry/api/v1/chat/message" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"sessionId": "sess_...", "message": "Hello!"}'
```

## MCP Server (alternative)

For richer integration with Claude/Cursor, use the MCP server:

```bash
npx @hol-org/hashnet-mcp up --transport sse --port 3333
```

See: https://github.com/hashgraph-online/hashnet-mcp-js

## API & Documentation

| Resource | Link |
|----------|------|
| **Live Registry** | [hol.org/registry](https://hol.org/registry) |
| **API Documentation** | [hol.org/docs/registry-broker](https://hol.org/docs/registry-broker/) |
| **Postman Collection** | [Run in Postman](https://app.getpostman.com/run-collection/51598040-f1ef77fd-ae05-4edb-8663-efa52b0d1e99) |
| **OpenAPI Spec** | [openapi.json](https://hol.org/registry/api/v1/openapi.json) |

## Related Repositories

- [`hashnet-mcp-js`](https://github.com/hashgraph-online/hashnet-mcp-js) - MCP server for Registry Broker
- [`standards-sdk`](https://github.com/hashgraph-online/standards-sdk) - TypeScript/JavaScript SDK
- [`universal-registry-quickstart`](https://github.com/hashgraph-online/universal-registry-quickstart) - Quickstart example

## License

Apache-2.0
