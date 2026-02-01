# Protocols Reference

The Universal Agentic Registry supports agents from 14+ protocols and registries.

## Supported Protocols

### AgentVerse (Fetch.ai)

- **Prefix**: `uaid:aid:fetchai:*`
- **Type**: Autonomous agents
- **Protocol**: Fetch.ai agent protocol
- **Chat**: Supported

### Virtuals Protocol

- **Prefix**: `uaid:virtuals:*`
- **Type**: Tokenized AI agents
- **Protocol**: Virtuals Protocol
- **Chat**: Supported

### Google A2A

- **Prefix**: `uaid:a2a:*`
- **Type**: Agent-to-Agent
- **Protocol**: Google A2A
- **Chat**: Supported

### MCP (Model Context Protocol)

- **Prefix**: `uaid:mcp:*`
- **Type**: MCP servers
- **Protocol**: Anthropic MCP
- **Chat**: Via tool invocation

### ERC-8004

- **Prefix**: `uaid:erc8004:*`
- **Type**: On-chain verified agents
- **Protocol**: ERC-8004
- **Chat**: Supported

### x402 Bazaar

- **Prefix**: `uaid:x402:*`
- **Type**: Agent payment rails
- **Protocol**: x402
- **Chat**: Supported with payments

### OpenRouter

- **Prefix**: `uaid:openrouter:*`
- **Type**: LLM gateway
- **Protocol**: OpenAI-compatible
- **Chat**: Supported

### NANDA

- **Prefix**: `uaid:nanda:*`
- **Type**: Decentralized AI
- **Protocol**: NANDA protocol
- **Chat**: Supported

### Near AI

- **Prefix**: `uaid:near:*`
- **Type**: Near Protocol agents
- **Protocol**: Near AI
- **Chat**: Supported

### OpenConvAI (HCS-10)

- **Prefix**: `uaid:hcs10:*`
- **Type**: Hedera agents
- **Protocol**: HCS-10
- **Chat**: Supported

### XMTP

- **Prefix**: `uaid:xmtp:*`
- **Type**: Decentralized messaging
- **Protocol**: XMTP
- **Chat**: Supported

### ANS (Agent Name Service)

- **Prefix**: `uaid:ans:*`
- **Type**: Named agents
- **Protocol**: ANS
- **Chat**: Varies

### PulseMCP

- **Prefix**: `uaid:pulsemcp:*`
- **Type**: MCP registry
- **Protocol**: MCP
- **Chat**: Via tool invocation

### Custom Registry

- **Prefix**: `uaid:custom:*`
- **Type**: User-registered agents
- **Protocol**: OpenAI-compatible
- **Chat**: Supported

## UAID Format

Universal Agent Identifiers (UAIDs) follow the format:

```
uaid:<adapter>:<agent-id>
```

Examples:
- `uaid:aid:fetchai:agent123`
- `uaid:virtuals:0x1234...`
- `uaid:openrouter:anthropic/claude-3`
- `uaid:hcs10:0.0.12345`

## Protocol Capabilities

| Protocol | Discovery | Chat | Registration | Payments |
|----------|-----------|------|--------------|----------|
| AgentVerse | Yes | Yes | No | No |
| Virtuals | Yes | Yes | No | Token |
| A2A | Yes | Yes | No | No |
| MCP | Yes | Tools | No | No |
| ERC-8004 | Yes | Yes | Yes | On-chain |
| x402 | Yes | Yes | Yes | x402 |
| OpenRouter | Yes | Yes | No | API |
| NANDA | Yes | Yes | No | No |
| Near AI | Yes | Yes | No | Near |
| HCS-10 | Yes | Yes | Yes | HBAR |
| XMTP | Yes | Yes | No | No |
| Custom | Yes | Yes | Yes | Credits |
