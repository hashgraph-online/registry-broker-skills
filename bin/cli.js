#!/usr/bin/env node

/**
 * HOL Registry CLI
 *
 * Quick commands to interact with the Universal Agentic Registry.
 *
 * Usage:
 *   npx @hol-org/registry search "trading bot"
 *   npx @hol-org/registry chat <uaid>
 *   npx @hol-org/registry resolve <uaid>
 *   npx @hol-org/registry stats
 *   npx @hol-org/registry balance
 *   npx @hol-org/registry skill
 */

const BASE_URL =
  process.env.REGISTRY_BROKER_API_URL || 'https://hol.org/registry/api/v1';
const API_KEY = process.env.REGISTRY_BROKER_API_KEY;

const SKILL_URL = 'https://hol.org/registry/skill.md';
const SKILL_JSON_URL = 'https://hol.org/registry/skill.json';

const HELP = `
HOL Registry CLI

Commands:
  search <query> [limit]    Search for agents (default limit: 5)
  chat <uaid> [message]     Start a chat session with an agent
  resolve <uaid>            Resolve UAID to agent details
  stats                     Get platform statistics
  balance                   Check credit balance (requires API key)
  skill                     Print the skill.md URL
  skill --json              Print the skill.json URL
  help                      Show this help message

Options:
  --transport <type>        Chat transport: xmtp (default), moltbook, http

Environment:
  REGISTRY_BROKER_API_KEY   Your API key (required for chat, balance)

Examples:
  npx @hol-org/registry search "trading bot"
  npx @hol-org/registry search "data analysis" 10
  npx @hol-org/registry resolve uaid:aid:fetchai:agent123
  npx @hol-org/registry chat uaid:aid:fetchai:agent123 "Hello!"
  npx @hol-org/registry chat uaid:aid:moltbook:bot --transport moltbook "Hi"
  npx @hol-org/registry stats
  npx @hol-org/registry skill

Get your API key at: https://hol.org/registry/dashboard
`;

async function search(query, limit = 5) {
  const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetch(url);
  const data = await response.json();

  console.log(`\nFound ${data.total || 0} agents for "${query}"\n`);

  const agents = data.hits || data.results || [];
  if (agents.length === 0) {
    console.log('No agents found.');
    return;
  }

  agents.forEach((agent, i) => {
    const name = agent.name || agent.profile?.name || 'Unknown';
    const description = (agent.description || agent.profile?.description || '').slice(0, 80);
    console.log(`${i + 1}. ${name}`);
    console.log(`   UAID: ${agent.uaid}`);
    if (description) {
      console.log(`   ${description}${description.length >= 80 ? '...' : ''}`);
    }
    console.log();
  });
}

async function chat(uaid, message, transport = 'xmtp') {
  console.log(`\nCreating chat session with ${uaid} (transport: ${transport})...\n`);

  const headers = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  }

  const sessionResponse = await fetch(`${BASE_URL}/chat/session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ uaid, transport }),
  });

  const session = await sessionResponse.json();

  if (!session.sessionId) {
    console.error('Failed to create session:', session);
    process.exit(1);
  }

  console.log(`Session created: ${session.sessionId}\n`);

  if (message) {
    console.log(`Sending: ${message}\n`);

    const msgHeaders = {
      'Content-Type': 'application/json',
    };
    if (API_KEY) {
      msgHeaders['x-api-key'] = API_KEY;
    }

    const messageResponse = await fetch(`${BASE_URL}/chat/message`, {
      method: 'POST',
      headers: msgHeaders,
      body: JSON.stringify({
        sessionId: session.sessionId,
        message,
      }),
    });

    const response = await messageResponse.json();
    console.log('Response:', JSON.stringify(response, null, 2));

    const deleteHeaders = {};
    if (API_KEY) {
      deleteHeaders['x-api-key'] = API_KEY;
    }
    await fetch(`${BASE_URL}/chat/session/${session.sessionId}`, {
      method: 'DELETE',
      headers: deleteHeaders,
    });

    console.log('\nSession ended.');
  } else {
    console.log('Session ready. Use the sessionId to send messages.');
    console.log(`SessionId: ${session.sessionId}`);
  }
}

async function resolve(uaid) {
  const url = `${BASE_URL}/resolve/${encodeURIComponent(uaid)}`;
  const response = await fetch(url);
  const data = await response.json();

  console.log('\nAgent Details:\n');
  console.log(JSON.stringify(data, null, 2));
}

async function stats() {
  const response = await fetch(`${BASE_URL}/stats`);
  const data = await response.json();

  console.log('\nRegistry Statistics:\n');
  console.log(JSON.stringify(data, null, 2));
}

async function balance() {
  if (!API_KEY) {
    console.error('Error: REGISTRY_BROKER_API_KEY environment variable required');
    console.error('Get your API key at: https://hol.org/registry/dashboard');
    process.exit(1);
  }

  const response = await fetch(`${BASE_URL}/credits/balance`, {
    headers: { 'x-api-key': API_KEY },
  });
  const data = await response.json();

  console.log('\nCredit Balance:\n');
  console.log(JSON.stringify(data, null, 2));
}

function skill(json = false) {
  if (json) {
    console.log(SKILL_JSON_URL);
  } else {
    console.log(SKILL_URL);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  const parseTransport = (argList) => {
    const idx = argList.findIndex(a => a === '--transport');
    if (idx !== -1 && argList[idx + 1]) {
      const transport = argList[idx + 1].toLowerCase();
      const filtered = argList.filter((_, i) => i !== idx && i !== idx + 1);
      return { transport, args: filtered };
    }
    return { transport: 'xmtp', args: argList };
  };

  try {
    switch (command) {
      case 'search':
        if (!args[1]) {
          console.error('Usage: search <query> [limit]');
          process.exit(1);
        }
        await search(args[1], parseInt(args[2]) || 5);
        break;

      case 'chat': {
        if (!args[1]) {
          console.error('Usage: chat <uaid> [--transport xmtp|moltbook|http] [message]');
          process.exit(1);
        }
        const uaid = args[1];
        const { transport, args: restArgs } = parseTransport(args.slice(2));
        const message = restArgs.join(' ') || null;
        await chat(uaid, message, transport);
        break;
      }

      case 'resolve':
        if (!args[1]) {
          console.error('Usage: resolve <uaid>');
          process.exit(1);
        }
        await resolve(args[1]);
        break;

      case 'stats':
        await stats();
        break;

      case 'balance':
        await balance();
        break;

      case 'skill':
        skill(args[1] === '--json');
        break;

      case 'help':
      case '--help':
      case '-h':
      case undefined:
        console.log(HELP);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
