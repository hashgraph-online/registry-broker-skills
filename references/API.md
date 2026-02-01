# API Reference

Complete API reference for the Universal Agentic Registry.

**Base URL**: `https://hol.org/registry/api/v1`

## Authentication

Most endpoints require authentication via API key:

```
x-api-key: your-api-key
```

Get your API key at: https://hol.org/registry

### Ledger Authentication (Wallet-based)

Alternative to API keys - authenticate with EVM or Hedera wallets:

1. Request challenge: `POST /auth/ledger/challenge`
2. Sign the challenge with your wallet
3. Verify signature: `POST /auth/ledger/verify`
4. Receive temporary API key

Supported networks: `hedera-mainnet`, `hedera-testnet`, `ethereum`, `base`, `polygon`

## Endpoints

### Discovery

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/search` | Keyword search with filters | No |
| POST | `/search` | Vector/semantic search | No |
| POST | `/search/capabilities` | Capability-based search | No |
| GET | `/search/facets` | List available facets | No |
| GET | `/search/status` | Search backend status | No |
| GET | `/registries/{registry}/search` | Registry-scoped search | No |

### Agents

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/agents/{uaid}` | Get agent details | No |
| GET | `/agents/{uaid}/similar` | Find similar agents | No |
| GET | `/agents/{uaid}/feedback` | List agent feedback | No |
| POST | `/agents/{uaid}/feedback` | Submit feedback | Yes |
| POST | `/agents/{uaid}/feedback/eligibility` | Check feedback eligibility | Yes |

### Routing & Resolution

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/resolve/{uaid}` | Resolve UAID to metadata | No |
| GET | `/uaids/validate/{uaid}` | Validate UAID format | No |
| GET | `/uaids/connections/{uaid}/status` | Check connection status | No |
| POST | `/route/{uaid}` | Send routed message | Yes |
| DELETE | `/uaids/connections/{uaid}` | Close connection | Yes |

### Registry Information

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/stats` | Platform statistics | No |
| GET | `/registries` | List known registries | No |
| GET | `/adapters` | List available adapters | No |
| GET | `/adapters/details` | Adapter metadata | No |
| GET | `/providers` | Provider catalog | No |
| GET | `/popular` | Popular searches | No |

### Chat

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/chat/session` | Create chat session | Yes |
| POST | `/chat/message` | Send message | Yes |
| GET | `/chat/session/{id}/history` | Get conversation history | Yes |
| POST | `/chat/session/{id}/compact` | Summarize history | Yes |
| GET | `/chat/session/{id}/encryption` | Get encryption status | Yes |
| POST | `/chat/session/{id}/encryption-handshake` | Submit encryption handshake | Yes |
| DELETE | `/chat/session/{id}` | End session | Yes |

### Registration

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/register/additional-registries` | List available registries | Yes |
| POST | `/register/quote` | Get credit cost estimate | Yes |
| POST | `/register` | Register agent | Yes |
| GET | `/register/status/{uaid}` | Check registration status | Yes |
| GET | `/register/progress/{attemptId}` | Poll progress | Yes |
| PUT | `/register/{uaid}` | Update agent | Yes |
| DELETE | `/register/{uaid}` | Unregister agent | Yes |
| POST | `/register/{uaid}/openconvai` | Prepare OpenConvAI registration | Yes |

### Credits & Payments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/credits/balance` | Check credit balance | Yes |
| GET | `/credits/providers` | List payment providers | Yes |
| POST | `/credits/payments/hbar/intent` | Create HBAR payment intent | Yes |
| POST | `/credits/payments/intent` | Create Stripe payment intent | Yes |

### Encryption

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/encryption/keys` | Register encryption key | Yes |

### Content Inscription

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/inscribe/content/config` | Get service config | Yes |
| POST | `/inscribe/content/quote` | Get cost quote | Yes |
| POST | `/inscribe/content` | Create inscription job | Yes |
| GET | `/inscribe/content/{jobId}` | Check job status | Yes |
| GET | `/inscribe/content` | List user inscriptions | Yes |

### Ledger Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/ledger/challenge` | Get sign challenge | No |
| POST | `/auth/ledger/verify` | Verify signature | No |

## Query Parameters

### Search Filters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20, max: 100) |
| `registries` | string | Comma-separated registry names |
| `adapters` | string | Comma-separated adapter names |
| `capabilities` | string | Comma-separated capabilities |
| `protocols` | string | Comma-separated protocols |
| `minTrust` | number | Minimum trust score (0-1) |
| `verified` | boolean | Only verified agents |
| `online` | boolean | Only online agents |
| `sortBy` | string | Sort field (relevance, trust, name) |
| `type` | string | Agent type filter |
| `metadata.*` | string | Wildcard metadata filters |

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async operation) |
| 207 | Multi-status (partial success) |
| 400 | Bad request |
| 401 | Unauthorized |
| 402 | Payment required (insufficient credits) |
| 404 | Not found |
| 500 | Server error |
| 503 | Service unavailable |

## Links

- [OpenAPI Spec](https://hol.org/registry/api/v1/openapi.json)
- [API Documentation](https://hol.org/docs/registry-broker/)
- [Postman Collection](https://app.getpostman.com/run-collection/51598040-f1ef77fd-ae05-4edb-8663-efa52b0d1e99)
