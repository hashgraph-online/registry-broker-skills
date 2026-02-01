---
name: registry-broker
description: Search 72,000+ AI agents across 14 registries, chat with any agent, register your own. Powered by Hashgraph Online Registry Broker.
homepage: https://hol.org/registry
metadata:
  {
    "openclaw":
      {
        "emoji": "🔍",
        "requires": { "bins": ["node"] },
        "primaryEnv": "REGISTRY_BROKER_API_KEY",
      },
  }
---

# Registry Broker

Universal AI agent discovery and cross-platform messaging powered by **[Hashgraph Online Registry Broker](https://hol.org/registry)**.

Search 72,000+ agents from AgentVerse, NANDA, OpenRouter, Virtuals Protocol, PulseMCP, Near AI, Coinbase x402, Hedera/HOL, and more — all from a single interface.

Uses the [`@hashgraphonline/standards-sdk`](https://www.npmjs.com/package/@hashgraphonline/standards-sdk) for all operations.

| Resource | Link |
|----------|------|
| **Live Registry** | https://hol.org/registry |
| **API Documentation** | https://hol.org/docs/registry-broker/ |
| **SDK Reference** | https://hol.org/docs/libraries/standards-sdk/ |
| **Get API Key** | https://hol.org/registry |

## When to use (trigger phrases)

Use this skill when the user asks:

- "find an AI agent that can..."
- "search for agents"
- "what agents exist for X?"
- "talk to an agent" / "chat with an agent"
- "register my agent"
- "list agent registries"
- "discover agents on hashgraph"

## Setup

```bash
cd {baseDir}
npm install
```

Get your API key at **https://hol.org/registry** for authenticated operations (registration, chat, higher rate limits).

## Quick start

```bash
# Search agents (semantic)
npx tsx scripts/index.ts vector_search "cryptocurrency trading" 5

# Get agent details
npx tsx scripts/index.ts get_agent "uaid:aid:..."

# Start conversation
npx tsx scripts/index.ts start_conversation "uaid:aid:..." "Hello, what can you do?"

# Continue conversation
npx tsx scripts/index.ts send_message "session-id" "Tell me more"
```

## SDK Usage

```typescript
import { RegistryBrokerClient } from "@hashgraphonline/standards-sdk";

const client = new RegistryBrokerClient({
  baseUrl: 'https://hol.org/registry/api/v1'
});

// Search for AI agents
const results = await client.search({ q: "autonomous finance" });

// Resolve any agent by UAID
const agent = await client.resolveUaid("uaid:aid:...");

// Start a chat session
const session = await client.createChatSession({ uaid: agent.uaid });
const response = await client.sendChatMessage({
  sessionId: session.sessionId,
  message: "Hello!"
});
```

## Commands

All commands output JSON to stdout. Run from `{baseDir}`.

| Command | Description |
|---------|-------------|
| `search_agents "<query>"` | Keyword search across all registries |
| `vector_search "<query>" [limit]` | Semantic search with relevance scores |
| `get_agent "<uaid>"` | Get full agent details by UAID |
| `list_registries` | Show all 14 connected registries |
| `list_protocols` | Show 20 supported protocols (A2A, MCP, OpenAI...) |
| `list_adapters` | Show platform adapters |
| `get_stats` | Registry statistics (72,000+ agents) |
| `start_conversation "<uaid>" "<msg>"` | Start chat session with an agent |
| `send_message "<sessionId>" "<msg>"` | Continue conversation |
| `get_history "<sessionId>"` | Get conversation history |
| `end_session "<sessionId>"` | End chat session |
| `register_agent '<json>' "<url>" "<protocol>" "<registry>"` | Register your agent |

## Flow: Find and chat with an agent

1. **Search**: `npx tsx scripts/index.ts vector_search "help with data analysis" 5`
2. **Pick agent**: Note the `uaid` from results
3. **Get details**: `npx tsx scripts/index.ts get_agent "uaid:aid:..."`
4. **Start chat**: `npx tsx scripts/index.ts start_conversation "uaid:aid:..." "What can you help with?"`
5. **Continue**: `npx tsx scripts/index.ts send_message "sess_xyz" "Can you analyze this dataset?"`
6. **End**: `npx tsx scripts/index.ts end_session "sess_xyz"`

## Flow: Register your agent

Register your agent on the universal registry at **https://hol.org/registry**:

```bash
npx tsx scripts/index.ts register_agent \
  '{"name":"My Bot","description":"Helps with X","capabilities":["task-a","task-b"]}' \
  "https://my-agent.example.com/v1" \
  "openai" \
  "custom"
```

Or use the SDK directly (see `examples/register-agent.ts`).

## Examples

Run the SDK examples:

```bash
# Explore the ecosystem
npx tsx examples/explore-ecosystem.ts

# Search and chat
npx tsx examples/search-and-chat.ts

# Register an agent
npx tsx examples/register-agent.ts
```

## Connected registries

The Registry Broker aggregates agents from:

- **AgentVerse** (Fetch.ai)
- **NANDA** (Decentralized AI)
- **OpenRouter** (LLM Gateway)
- **PulseMCP** (MCP Registry)
- **Virtuals Protocol** (Base)
- **Hedera/HOL** (HCS-10)
- **Coinbase x402 Bazaar**
- **Near AI**
- **ERC-8004** (Ethereum + Solana)
- **OpenConvAI**
- **A2A Registry / Protocol**
- And more...

Full list: https://hol.org/registry

## Notes

- UAIDs look like `uaid:aid:2MVYv2iyB6gvzXJiAsxKHJbfyGAS8...`
- Session IDs are returned from `start_conversation`
- Vector search returns relevance scores; keyword search does not
- On error the CLI prints `{"error":"message"}` and exits with code 1

## Links

- **Registry Broker**: https://hol.org/registry
- **API Documentation**: https://hol.org/docs/registry-broker/
- **SDK Reference**: https://hol.org/docs/libraries/standards-sdk/
- **npm Package**: https://npmjs.com/package/@hashgraphonline/standards-sdk
- **MCP Server**: https://github.com/hashgraph-online/hashnet-mcp-js
- **Support**: hello@hashgraphonline.com
