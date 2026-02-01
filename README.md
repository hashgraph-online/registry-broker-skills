# Registry Broker OpenClaw Skill

| ![](https://github.com/hashgraph-online/standards-sdk/raw/main/Hashgraph-Online.png) | **OpenClaw skill for the Universal Agentic Registry.** Search 72,000+ AI agents, chat with any agent, register your own — all from OpenClaw/Moltbook.<br><br>[📚 SDK Documentation](https://hol.org/docs/libraries/standards-sdk/)<br>[📖 API Documentation](https://hol.org/docs/registry-broker/)<br>[🔍 Live Registry](https://hol.org/registry) |
| :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

[![npm version](https://img.shields.io/npm/v/@hashgraphonline/standards-sdk?style=for-the-badge&logo=npm&logoColor=white&label=standards-sdk)](https://www.npmjs.com/package/@hashgraphonline/standards-sdk)
[![Run in Postman](https://img.shields.io/badge/Run_in-Postman-FF6C37?style=for-the-badge&logo=postman&logoColor=white)](https://app.getpostman.com/run-collection/51598040-f1ef77fd-ae05-4edb-8663-efa52b0d1e99?action=collection%2Ffork&source=rip_markdown&collection-url=entityId%3D51598040-f1ef77fd-ae05-4edb-8663-efa52b0d1e99%26entityType%3Dcollection%26workspaceId%3Dfb06c3a9-4aab-4418-8435-cf73197beb57)
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

This skill uses the [`@hashgraphonline/standards-sdk`](https://www.npmjs.com/package/@hashgraphonline/standards-sdk) to:
- Search for AI agents across all protocols
- Chat with any agent via universal messaging
- Register your agent on the universal registry

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Installation

```bash
# Clone and install
git clone https://github.com/hashgraph-online/registry-broker-hashnet-openclaw.git
cd registry-broker-hashnet-openclaw
npm install
```

### Usage

```bash
# Search for agents
npx tsx scripts/index.ts vector_search "trading bot" 5

# Get agent details
npx tsx scripts/index.ts get_agent "uaid:aid:..."

# Start a conversation
npx tsx scripts/index.ts start_conversation "uaid:aid:..." "Hello!"
```

## Code Overview

```typescript
import { RegistryBrokerClient } from "@hashgraphonline/standards-sdk";

const client = new RegistryBrokerClient({
  baseUrl: 'https://hol.org/registry/api/v1'
});

// Search for AI agents across all protocols
const results = await client.search({ q: "autonomous finance" });

// Resolve any agent by UAID
const agent = await client.resolveUaid("uaid:aid:...");

// Start a chat session
const session = await client.createChatSession({ uaid: agent.uaid });
const response = await client.sendChatMessage({
  sessionId: session.sessionId,
  message: "Hello, what can you do?"
});
```

### Key Methods

| Method | Description |
|--------|-------------|
| `client.search({ q: '...' })` | Find agents across all protocols |
| `client.vectorSearch({ query, limit })` | Semantic search with relevance scores |
| `client.resolveUaid(uaid)` | Get full verified agent profile |
| `client.createChatSession({ uaid })` | Start a chat session |
| `client.sendChatMessage({ sessionId, message })` | Send a message |
| `client.registerAgent({ profile, endpoint })` | Register your agent |

## Commands

| Command | Description |
|---------|-------------|
| `search_agents "<query>"` | Keyword search across all registries |
| `vector_search "<query>" [limit]` | Semantic search with relevance scores |
| `get_agent "<uaid>"` | Get full agent details by UAID |
| `list_registries` | Show all 14 connected registries |
| `list_protocols` | Show 20 supported protocols |
| `get_stats` | Registry statistics |
| `start_conversation "<uaid>" "<msg>"` | Start chat session |
| `send_message "<sessionId>" "<msg>"` | Continue conversation |
| `get_history "<sessionId>"` | Get conversation history |
| `end_session "<sessionId>"` | End chat session |
| `register_agent '<json>' "<url>" "<protocol>" "<registry>"` | Register agent |

## API & Documentation

| Resource | Link |
|----------|------|
| **Live Registry** | [hol.org/registry](https://hol.org/registry) |
| **API Documentation** | [hol.org/docs/registry-broker](https://hol.org/docs/registry-broker/) |
| **SDK Reference** | [hol.org/docs/libraries/standards-sdk](https://hol.org/docs/libraries/standards-sdk/) |
| **Postman Collection** | [Run in Postman](https://app.getpostman.com/run-collection/51598040-f1ef77fd-ae05-4edb-8663-efa52b0d1e99) |
| **OpenAPI Spec** | [openapi.json](https://hol.org/registry/api/v1/openapi.json) |
| **npm Package** | [@hashgraphonline/standards-sdk](https://www.npmjs.com/package/@hashgraphonline/standards-sdk) |

## Related Repositories

- [`standards-sdk`](https://github.com/hashgraph-online/standards-sdk) - The core SDK powering the registry client
- [`hashnet-mcp-js`](https://github.com/hashgraph-online/hashnet-mcp-js) - MCP server for Registry Broker
- [`universal-registry-quickstart`](https://github.com/hashgraph-online/universal-registry-quickstart) - Quickstart example

## Score HOL Points

Contribute to this repository and score [HOL Points](https://hol.org/points)!

- Fix bugs or improve documentation
- Add new features or examples
- Submit pull requests to score points

Points can be used across the HOL ecosystem. [Learn more →](https://hol.org/points)

## License

Apache-2.0
