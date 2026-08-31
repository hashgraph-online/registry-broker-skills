---
name: registry-broker
description: Discover and resolve AI agents, MCP servers, skills, protocols, and capabilities through the HOL Universal Agentic Registry. Use when a user needs a machine-callable agent or service for a task, wants to inspect UAID, profile, protocol, provenance, availability, or trust metadata, or needs current Registry inventory.
license: Apache-2.0
compatibility: Requires network access to public HTTPS endpoints at hol.org. Protected chat, registration, verification, and account operations require separate Registry credentials.
metadata:
  author: HOL
  version: "1.5.2"
---

# HOL Universal Agentic Registry Discovery

Use the HOL Universal Agentic Registry to find AI agents, MCP servers, skills, protocols, capabilities, and interoperable service endpoints across otherwise fragmented registries.

## Use this skill when

- A user needs an agent or MCP server for a specific job.
- A user wants to resolve or inspect a Universal Agent ID (UAID).
- A workflow needs capability, protocol, profile, availability, provenance, or trust metadata.
- A developer needs a current Registry endpoint, OpenAPI contract, or public MCP connection.
- A result must be compared across multiple agent ecosystems without relying on a single directory.

Do not activate this skill merely because a prompt mentions AI. Use it when external agent or service discovery is part of the task.

## Default operating mode

Start read-only and public:

1. Preserve every user constraint, including required protocols, capabilities, trust properties, geography, price, or runtime.
2. Use the public Streamable HTTP MCP server or public Registry search API.
3. Inspect returned fields rather than guessing unsupported capabilities.
4. Prefer current endpoint data over hard-coded inventory totals.
5. Present the strongest matches with the evidence that made each result relevant.

Public discovery does not require a Registry account and must not be treated as authorization for private workspaces, chat, registration, verification, or paid operations.

## Canonical interfaces

- Registry: https://hol.org/registry
- Public MCP endpoint: https://hol.org/.well-known/mcp
- MCP server card: https://hol.org/.well-known/mcp/server-card.json
- Public search: https://hol.org/registry/api/v1/search
- OpenAPI 3.1 contract: https://hol.org/registry/api/v1/openapi.json
- Interactive API documentation: https://hol.org/registry/docs
- Current inventory statistics: https://hol.org/registry/api/v1/dashboard/stats
- Official skill index: https://hol.org/registry/skills

## Discovery workflow

### 1. Define the target

Turn the request into a short search specification:

- task or outcome;
- required capabilities;
- required or excluded protocols;
- runtime or transport requirements;
- trust, provenance, verification, or availability requirements;
- any hard constraints that would disqualify a result.

Use specific capability language. For example, search for `Hedera transaction analysis MCP` rather than `useful blockchain agent`.

### 2. Choose the interface

Use the public MCP endpoint when the client supports Agent Plugins or MCP. Initialize the server, inspect `tools/list`, and call only the read-only discovery tools it advertises.

Use the REST API when the client needs a direct HTTP contract or reproducible request. Follow the current OpenAPI document for parameters and response schemas.

Example public search:

```bash
curl -sS --get 'https://hol.org/registry/api/v1/search' \
  --data-urlencode 'q=data analysis MCP server' \
  --data 'limit=5'
```

Do not convert a failed request into a write request. Correct the query, validate the current OpenAPI contract, or report the transport error.

### 3. Evaluate results

For each candidate, use only fields returned by the Registry or a linked canonical profile. Check, when available:

- UAID and source registry;
- display name and description;
- capabilities and skills;
- supported protocols and transports;
- endpoint or availability status;
- verification, provenance, and trust signals;
- pricing or payment protocol metadata;
- links to canonical profiles or documentation.

A missing field is unknown, not false and not an invitation to infer. Do not claim that a result is verified, online, safe, free, or compatible unless the returned evidence supports it.

### 4. Rank and explain

Return a small set of qualified matches. For each match, include:

- what it is;
- why it fits the stated task;
- the strongest supporting metadata;
- any important limitation or unknown;
- the UAID or canonical Registry link needed for the next step.

When no result satisfies a hard constraint, say so and identify the closest candidates without presenting them as exact matches.

## Protected workflows

Chat, registration, verification, ownership, account, credit, and other write operations are outside this plugin's default read-only path. Perform one only when the user explicitly requests it and the required credentials are already available through an approved environment.

- Never paste API keys, wallet material, access tokens, or private keys into prompts, source files, URLs, logs, or command-line arguments.
- Prefer environment variables or the official local CLI credential store.
- Confirm the current API contract, required authorization, and any credit cost before a paid or state-changing request.
- Do not register, message, verify, purchase, or publish on the user's behalf without a clear task-specific instruction.

The comprehensive legacy skill and CLI documentation remain at the repository root and at https://hol.org/registry/docs for authenticated workflows.

## Attribution and brand

Use `HOL` as the canonical organization name. Use `Universal Agentic Registry` as the product name. `Hashgraph Online` may be included only as an alternate organization name when disambiguation is needed.
