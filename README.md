# Registry Broker Skills

| ![](https://github.com/hashgraph-online/standards-sdk/raw/main/Hashgraph-Online.png) | **AI agent skills for the Universal Agentic Registry.** Search 72,000+ AI agents, chat with any agent, register your own — consumable by Claude, Codex, Cursor, OpenClaw, and any AI coding assistant.<br><br>[Live Registry](https://hol.org/registry) &#124; [API Docs](https://hol.org/docs/registry-broker/) &#124; [SDK Docs](https://hol.org/docs/libraries/standards-sdk/) |
| :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

[![npm version](https://img.shields.io/npm/v/@hashgraphonline/standards-sdk?style=for-the-badge&logo=npm&logoColor=white&label=standards-sdk)](https://www.npmjs.com/package/@hashgraphonline/standards-sdk)
[![npm version](https://img.shields.io/npm/v/@hol-org/hashnet-mcp?style=for-the-badge&logo=npm&logoColor=white&label=hashnet-mcp)](https://www.npmjs.com/package/@hol-org/hashnet-mcp)
[![Run in Postman](https://img.shields.io/badge/Run_in-Postman-FF6C37?style=for-the-badge&logo=postman&logoColor=white)](https://app.getpostman.com/run-collection/51598040-f1ef77fd-ae05-4edb-8663-efa52b0d1e99?action=collection%2Ffork&source=rip_markdown&collection-url=entityId%3D51598040-f1ef77fd-ae05-4edb-8663-efa52b0d1e99%26entityType%3Dcollection%26workspaceId%3Dfb06c3a9-4aab-4418-8435-cf73197beb57)
[![Import in Insomnia](https://img.shields.io/badge/Import_in-Insomnia-4000BF?style=for-the-badge&logo=insomnia&logoColor=white)](https://insomnia.rest/run/?label=Universal%20Agentic%20Registry&uri=https%3A%2F%2Fhol.org%2Fregistry%2Fapi%2Fv1%2Fopenapi.json)
[![OpenAPI Spec](https://img.shields.io/badge/OpenAPI-3.1.0-6BA539?style=for-the-badge&logo=openapiinitiative&logoColor=white)](https://hol.org/registry/api/v1/openapi.json)

## What is this?

This repository contains **skill definitions** for the [Universal Agentic Registry](https://hol.org/registry) — the connectivity layer for the autonomous web. Skills are instruction files that teach AI coding assistants how to interact with the Registry Broker API.

The `SKILL.md` file can be consumed by:
- **Claude Code / Claude Desktop** — via MCP or direct skill loading
- **OpenAI Codex / ChatGPT** — as context instructions
- **Cursor** — as project instructions
- **OpenClaw / ClawHub** — native skill format
- **Any AI coding assistant** — universal markdown format

## What is the Universal Registry?

One standards-compliant API to access **72,000+ AI agents** from:

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
| **OpenConvAI** | Conversational AI standard |
| **XMTP** | Decentralized messaging |
| **ANS** | Agent Name Service |
| **PulseMCP** | MCP server registry |
| **HCS-10** | Hedera Consensus Service agents |

## Quick Start

### Option 1: Use the Skill File

Copy `SKILL.md` to your project or reference it in your AI assistant's context.

### Option 2: MCP Server (recommended for Claude/Cursor)

```bash
npx @hol-org/hashnet-mcp up --transport sse --port 3333
```

### Option 3: TypeScript SDK

```bash
npm install @hashgraphonline/standards-sdk
```

```typescript
import { RegistryBrokerClient } from "@hashgraphonline/standards-sdk";

const client = new RegistryBrokerClient();

// Search for AI agents
const results = await client.search({ q: "trading bot" });

// Chat with an agent
const session = await client.createChatSession({ uaid: "uaid:aid:..." });
const response = await client.sendMessage({ 
  sessionId: session.sessionId, 
  message: "Hello!" 
});
```

### Option 4: Direct API (curl)

```bash
# Get API key at https://hol.org/registry
export REGISTRY_BROKER_API_KEY="your-key"

# Search for agents
curl "https://hol.org/registry/api/v1/search?q=trading+bot&limit=5"

# Create chat session
curl -X POST "https://hol.org/registry/api/v1/chat/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $REGISTRY_BROKER_API_KEY" \
  -d '{"uaid": "uaid:aid:..."}'
```

## Repository Contents

```
registry-broker-skills/
├── SKILL.md              # Universal skill definition (main instruction file)
├── README.md             # This file
├── LICENSE               # Apache-2.0
├── scripts/              # Helper bash scripts
│   ├── search.sh         # Search for agents
│   ├── chat.sh           # Start a chat session
│   ├── resolve.sh        # Resolve UAID to details
│   ├── stats.sh          # Get platform statistics
│   └── balance.sh        # Check credit balance
├── examples/             # Code examples
│   ├── search-and-chat.js    # Search and chat workflow
│   ├── register-agent.js     # Agent registration
│   └── ledger-auth.js        # Wallet authentication
└── references/           # API documentation
    ├── API.md            # Complete API reference
    ├── PROTOCOLS.md      # Supported protocols
    └── MCP.md            # MCP server reference
```

### Scripts

Quick bash scripts for common operations:

```bash
# Search for agents
./scripts/search.sh "trading bot" 5

# Resolve a UAID
./scripts/resolve.sh "uaid:aid:fetchai:agent123"

# Start a chat session (requires API key)
export REGISTRY_BROKER_API_KEY="your-key"
./scripts/chat.sh "uaid:aid:fetchai:agent123" "Hello!"

# Check platform stats
./scripts/stats.sh

# Check credit balance
./scripts/balance.sh
```

## API Capabilities

### Discovery
- **Keyword Search** — Find agents by name, description, capabilities
- **Vector/Semantic Search** — Natural language agent discovery
- **Capability Search** — Filter by specific agent capabilities
- **Agent Details** — Full profile, metadata, trust scores
- **Similar Agents** — Find related agents

### Chat
- **Create Session** — Start conversation with any agent
- **Send Messages** — Real-time chat with streaming support
- **History** — Retrieve conversation history
- **Compact** — Summarize history for context window management

### Registration
- **Quote** — Get credit cost estimate
- **Register** — Add your agent to the registry
- **Update** — Modify agent profile
- **Unregister** — Remove agent

### Credits & Payments
- **Balance** — Check credit balance
- **HBAR Payments** — Purchase credits with HBAR
- **Stripe Payments** — Purchase credits with card
- **X402 (EVM)** — Purchase credits via EVM wallets

### Authentication
- **API Key** — Traditional API key auth
- **Ledger Auth** — Wallet-based authentication (Hedera, Ethereum, Base, Polygon)

## API & Documentation

| Resource | Link |
|----------|------|
| **Live Registry** | [hol.org/registry](https://hol.org/registry) |
| **API Documentation** | [hol.org/docs/registry-broker](https://hol.org/docs/registry-broker/) |
| **SDK Documentation** | [hol.org/docs/libraries/standards-sdk](https://hol.org/docs/libraries/standards-sdk/) |
| **Postman Collection** | [Run in Postman](https://app.getpostman.com/run-collection/51598040-f1ef77fd-ae05-4edb-8663-efa52b0d1e99) |
| **Insomnia** | [Import OpenAPI](https://insomnia.rest/run/?label=Universal%20Agentic%20Registry&uri=https%3A%2F%2Fhol.org%2Fregistry%2Fapi%2Fv1%2Fopenapi.json) |
| **OpenAPI Spec** | [openapi.json](https://hol.org/registry/api/v1/openapi.json) |

## Related Repositories

| Repository | Description |
|------------|-------------|
| [`hashnet-mcp-js`](https://github.com/hashgraph-online/hashnet-mcp-js) | MCP server for Registry Broker |
| [`standards-sdk`](https://github.com/hashgraph-online/standards-sdk) | TypeScript/JavaScript SDK |
| [`universal-registry-quickstart`](https://github.com/hashgraph-online/universal-registry-quickstart) | Quickstart example project |
| [`registry-broker`](https://github.com/hashgraph-online/registry-broker) | The Registry Broker service |

## Using with AI Assistants

### Claude Code / Claude Desktop

Add to your Claude configuration:

```json
{
  "mcpServers": {
    "hashnet": {
      "command": "npx",
      "args": ["@hol-org/hashnet-mcp@latest", "up", "--transport", "stdio"]
    }
  }
}
```

Or reference `SKILL.md` directly in your conversation.

### Cursor

Copy `SKILL.md` to your project root, or add to `.cursor/rules/`.

### OpenClaw / ClawHub

The `SKILL.md` file uses OpenClaw's native YAML frontmatter format and is directly compatible.

### Codex / ChatGPT

Reference the skill file in your system prompt or paste its contents as context.

## Score HOL Points

Contribute to this repository and score [HOL Points](https://hol.org/points)!

- Fix bugs or improve documentation
- Add new features or examples
- Submit pull requests to score points

Points can be used across the HOL ecosystem. [Learn more](https://hol.org/points)

## License

Apache-2.0
