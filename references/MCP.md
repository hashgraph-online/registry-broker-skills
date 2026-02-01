# MCP Server Reference

The `@hol-org/hashnet-mcp` package provides a Model Context Protocol (MCP) server for the Registry Broker.

## Installation

```bash
npx @hol-org/hashnet-mcp up --transport sse --port 3333
```

Or for Claude Desktop (stdio):

```bash
npx @hol-org/hashnet-mcp up --transport stdio
```

## Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hashnet": {
      "command": "npx",
      "args": ["@hol-org/hashnet-mcp@latest", "up", "--transport", "stdio"],
      "env": {
        "REGISTRY_BROKER_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Code / Cursor

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "hashnet": {
      "url": "http://localhost:3333/mcp/stream"
    }
  }
}
```

## Available Tools

### Discovery Tools

| Tool | Description |
|------|-------------|
| `hol.search` | Keyword search with filters |
| `hol.vectorSearch` | Semantic similarity search |
| `hol.agenticSearch` | Hybrid semantic + lexical search |
| `hol.resolveUaid` | Resolve and validate UAID |

### Chat Tools

| Tool | Description |
|------|-------------|
| `hol.chat.createSession` | Open session by UAID or agentUrl |
| `hol.chat.sendMessage` | Send message (auto-creates session if needed) |
| `hol.chat.history` | Get conversation history |
| `hol.chat.compact` | Summarize history for context window |
| `hol.chat.end` | Close session |

### Registration Tools

| Tool | Description |
|------|-------------|
| `hol.getRegistrationQuote` | Get credit cost estimate |
| `hol.registerAgent` | Submit registration |
| `hol.waitForRegistrationCompletion` | Poll until done |

### Credit Tools

| Tool | Description |
|------|-------------|
| `hol.credits.balance` | Check credit balance |
| `hol.purchaseCredits.hbar` | Buy credits with HBAR |
| `hol.x402.minimums` | Get X402 payment minimums |
| `hol.x402.buyCredits` | Buy credits via X402 (EVM) |

### Ledger Authentication Tools

| Tool | Description |
|------|-------------|
| `hol.ledger.challenge` | Get wallet sign challenge |
| `hol.ledger.authenticate` | Verify signature, get temp API key |

### Workflow Tools

| Tool | Description |
|------|-------------|
| `workflow.discovery` | Search + resolve flow |
| `workflow.registerMcp` | Quote + register + wait |
| `workflow.chatSmoke` | Test chat lifecycle |
| `workflow.openrouterChat` | Discover + ping OpenRouter model |
| `workflow.ledgerAuth` | Challenge + verify flow |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REGISTRY_BROKER_API_KEY` | API key for authenticated operations | Yes |
| `REGISTRY_BROKER_API_URL` | Override base URL | No |
| `PORT` | Server port for SSE transport | No |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | No |
| `HEDERA_ACCOUNT_ID` | Hedera account for payments | No |
| `HEDERA_PRIVATE_KEY` | Hedera key for payments | No |

## Links

- [GitHub Repository](https://github.com/hashgraph-online/hashnet-mcp-js)
- [npm Package](https://www.npmjs.com/package/@hol-org/hashnet-mcp)
