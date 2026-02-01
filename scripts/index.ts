#!/usr/bin/env npx tsx
/**
 * Registry Broker OpenClaw Skill - CLI
 *
 * Powered by Hashgraph Online Registry Broker
 * Website: https://hol.org/registry
 * API Docs: https://hol.org/docs/registry-broker/
 * SDK Docs: https://hol.org/docs/libraries/standards-sdk/
 * Get API Key: https://hol.org/registry
 *
 * Uses: @hashgraphonline/standards-sdk
 *
 * Usage: npx tsx scripts/index.ts <tool> [params...]
 *   search_agents "<query>"
 *   vector_search "<query>" [limit]
 *   get_agent "<uaid>"
 *   list_registries
 *   list_protocols
 *   list_adapters
 *   get_stats
 *   register_agent '<profileJson>' [endpoint] [protocol] [registry]
 *   start_conversation "<uaid>" "<message>" [senderUaid]
 *   send_message "<sessionId>" "<message>"
 *   get_history "<sessionId>"
 *   end_session "<sessionId>"
 *
 * Requires env (or .env):
 *   REGISTRY_BROKER_API_KEY (optional) - API key for authenticated operations
 *   REGISTRY_BROKER_BASE_URL (optional) - Custom base URL
 *
 * Output: single JSON value to stdout. On error: {"error":"message"} and exit 1.
 */
import 'dotenv/config';
import { RegistryBrokerClient } from '@hashgraphonline/standards-sdk';

const DEFAULT_BASE_URL = 'https://hol.org/registry/api/v1';

function getClient(): RegistryBrokerClient {
  return new RegistryBrokerClient({
    baseUrl: process.env.REGISTRY_BROKER_BASE_URL || DEFAULT_BASE_URL,
    apiKey: process.env.REGISTRY_BROKER_API_KEY,
  });
}

function out(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function cliErr(message: string): never {
  out({ error: message });
  process.exit(1);
}

async function withClient<T>(fn: (client: RegistryBrokerClient) => Promise<T>): Promise<void> {
  try {
    const client = getClient();
    const result = await fn(client);
    out(result ?? {});
  } catch (e) {
    cliErr(e instanceof Error ? e.message : String(e));
  }
}

async function searchAgents(client: RegistryBrokerClient, query: string) {
  const result = await client.search({ q: query, limit: 20 });
  return {
    total: result.total,
    agents: result.hits.map((hit) => ({
      uaid: hit.uaid,
      name: hit.name ?? hit.uaid,
      description: hit.description,
      protocol: hit.protocol,
      registry: hit.registry,
      capabilities: hit.capabilities,
      type: hit.type,
      online: hit.online,
      verified: hit.verified,
      trustScore: hit.trustScore,
    })),
  };
}

async function vectorSearch(client: RegistryBrokerClient, query: string, limit = 10) {
  const result = await client.vectorSearch({ query, limit });
  return {
    total: result.total,
    took: result.took,
    agents: result.hits.map((hit) => ({
      uaid: hit.agent?.uaid ?? hit.uaid,
      name: hit.agent?.name ?? hit.name ?? hit.uaid,
      description: hit.agent?.description ?? hit.description,
      protocol: hit.agent?.protocol ?? hit.protocol,
      registry: hit.agent?.registry ?? hit.registry,
      score: hit.score,
      highlights: hit.highlights,
    })),
  };
}

async function getAgent(client: RegistryBrokerClient, uaid: string) {
  const result = await client.resolveUaid(uaid);
  return {
    uaid: result.uaid,
    name: result.profile?.display_name ?? result.name,
    description: result.profile?.bio ?? result.description,
    endpoint: result.endpoint,
    protocol: result.protocol,
    registry: result.registry,
    capabilities: result.capabilities,
    type: result.type,
    metadata: result.metadata,
    profile: result.profile,
  };
}

async function listRegistries(client: RegistryBrokerClient) {
  const result = await client.getRegistries();
  return {
    registries: result.registries.map((name: string) => ({ name })),
  };
}

async function listProtocols(client: RegistryBrokerClient) {
  const result = await client.getProtocols();
  return {
    protocols: result.protocols.map((name: string) => ({ name })),
  };
}

async function listAdapters(client: RegistryBrokerClient) {
  const result = await client.getAdapters();
  return {
    adapters: result.adapters.map((name: string) => ({ name })),
  };
}

async function getStats(client: RegistryBrokerClient) {
  const result = await client.getStats();
  return {
    totalAgents: result.totalAgents,
    totalRegistries: result.registryCount,
    totalProtocols: result.protocolCount,
    onlineAgents: result.onlineAgents,
    verifiedAgents: result.verifiedAgents,
  };
}

async function registerAgent(
  client: RegistryBrokerClient,
  profileJson: string,
  endpoint?: string,
  protocol?: string,
  registry?: string
) {
  let profile: Record<string, unknown>;
  try {
    profile = JSON.parse(profileJson) as Record<string, unknown>;
  } catch {
    return cliErr('Invalid profile JSON');
  }

  const result = await client.registerAgent({
    profile: profile as any,
    endpoint,
    communicationProtocol: protocol,
    registry,
  });

  return {
    success: true,
    uaid: result.uaid,
    status: result.status,
    message: result.message,
    attemptId: result.attemptId,
  };
}

async function startConversation(
  client: RegistryBrokerClient,
  uaid: string,
  message: string,
  _senderUaid?: string
) {
  const session = await client.createChatSession({ uaid });
  const response = await client.sendChatMessage({
    sessionId: session.sessionId,
    message,
  });

  return {
    sessionId: session.sessionId,
    mode: session.encryption?.enabled ? 'encrypted' : 'plaintext',
    response: response.response,
    messageId: response.messageId,
  };
}

async function sendMessage(client: RegistryBrokerClient, sessionId: string, message: string) {
  const response = await client.sendChatMessage({ sessionId, message });
  return {
    response: response.response,
    messageId: response.messageId,
  };
}

async function getHistory(client: RegistryBrokerClient, sessionId: string) {
  const snapshot = await client.getChatHistory(sessionId);
  return {
    sessionId,
    history: snapshot.history.map((entry: any) => ({
      role: entry.role,
      content: entry.content,
      timestamp: entry.timestamp,
      messageId: entry.messageId,
    })),
  };
}

async function endSession(client: RegistryBrokerClient, sessionId: string) {
  await client.endChatSession(sessionId);
  return { success: true, message: `Session ${sessionId} ended` };
}

const USAGE = `Registry Broker OpenClaw Skill
Powered by Hashgraph Online: https://hol.org/registry
SDK: @hashgraphonline/standards-sdk

Usage:
  search_agents "<query>"
  vector_search "<query>" [limit]
  get_agent "<uaid>"
  list_registries
  list_protocols
  list_adapters
  get_stats
  register_agent '<profileJson>' [endpoint] [protocol] [registry]
  start_conversation "<uaid>" "<message>" [senderUaid]
  send_message "<sessionId>" "<message>"
  get_history "<sessionId>"
  end_session "<sessionId>"

Get your API key at https://hol.org/registry`;

type ToolHandler = {
  validate: (args: string[]) => string | null;
  run: (client: RegistryBrokerClient, args: string[]) => Promise<unknown>;
};

const TOOLS: Record<string, ToolHandler> = {
  search_agents: {
    validate: (args) =>
      !args[0]?.trim() ? 'Usage: search_agents "<query>"' : null,
    run: async (client, args) => searchAgents(client, args[0]!.trim()),
  },
  vector_search: {
    validate: (args) =>
      !args[0]?.trim() ? 'Usage: vector_search "<query>" [limit]' : null,
    run: async (client, args) =>
      vectorSearch(
        client,
        args[0]!.trim(),
        args[1] ? parseInt(args[1], 10) : undefined
      ),
  },
  get_agent: {
    validate: (args) => (!args[0]?.trim() ? 'Usage: get_agent "<uaid>"' : null),
    run: async (client, args) => getAgent(client, args[0]!.trim()),
  },
  list_registries: {
    validate: () => null,
    run: async (client) => listRegistries(client),
  },
  list_protocols: {
    validate: () => null,
    run: async (client) => listProtocols(client),
  },
  list_adapters: {
    validate: () => null,
    run: async (client) => listAdapters(client),
  },
  get_stats: {
    validate: () => null,
    run: async (client) => getStats(client),
  },
  register_agent: {
    validate: (args) => {
      if (!args[0]?.trim())
        return "Usage: register_agent '<profileJson>' [endpoint] [protocol] [registry]";
      try {
        JSON.parse(args[0]);
      } catch {
        return 'Invalid profile JSON';
      }
      return null;
    },
    run: async (client, args) =>
      registerAgent(client, args[0]!, args[1], args[2], args[3]),
  },
  start_conversation: {
    validate: (args) =>
      !args[0]?.trim() || !args[1]?.trim()
        ? 'Usage: start_conversation "<uaid>" "<message>" [senderUaid]'
        : null,
    run: async (client, args) =>
      startConversation(client, args[0]!.trim(), args[1]!.trim(), args[2]),
  },
  send_message: {
    validate: (args) =>
      !args[0]?.trim() || !args[1]?.trim()
        ? 'Usage: send_message "<sessionId>" "<message>"'
        : null,
    run: async (client, args) =>
      sendMessage(client, args[0]!.trim(), args[1]!.trim()),
  },
  get_history: {
    validate: (args) =>
      !args[0]?.trim() ? 'Usage: get_history "<sessionId>"' : null,
    run: async (client, args) => getHistory(client, args[0]!.trim()),
  },
  end_session: {
    validate: (args) =>
      !args[0]?.trim() ? 'Usage: end_session "<sessionId>"' : null,
    run: async (client, args) => endSession(client, args[0]!.trim()),
  },
};

async function runCli(): Promise<void> {
  const [, , tool = '', ...args] = process.argv;
  const handler = TOOLS[tool];
  if (!handler) {
    cliErr(USAGE);
  }
  const err = handler.validate(args);
  if (err) cliErr(err);
  await withClient((client) => handler.run(client, args));
}

const toolArg = process.argv[2] ?? '';
if (toolArg in TOOLS) {
  runCli().catch((e) => {
    out({ error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  });
} else {
  cliErr(USAGE);
}
