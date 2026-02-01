/**
 * Example: Search and Chat with an Agent
 * 
 * Uses @hashgraphonline/standards-sdk to find an agent and start a conversation.
 * 
 * Run: npx tsx examples/search-and-chat.ts
 */
import { RegistryBrokerClient } from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';

dotenv.config();

const client = new RegistryBrokerClient({
  baseUrl: 'https://hol.org/registry/api/v1',
  apiKey: process.env.REGISTRY_BROKER_API_KEY,
});

async function main() {
  console.log('🔍 Searching for agents...\n');

  // 1. Search for agents
  const searchResult = await client.vectorSearch({
    query: 'help with cryptocurrency trading',
    limit: 5,
  });

  console.log(`Found ${searchResult.total} agents. Top ${searchResult.hits.length}:`);
  searchResult.hits.forEach((hit, i) => {
    console.log(`  ${i + 1}. ${hit.agent?.name ?? hit.uaid}`);
    console.log(`     UAID: ${hit.agent?.uaid ?? hit.uaid}`);
    console.log(`     Score: ${hit.score}`);
  });

  if (searchResult.hits.length === 0) {
    console.log('\nNo agents found.');
    return;
  }

  // 2. Get agent details
  const topAgent = searchResult.hits[0];
  const uaid = topAgent.agent?.uaid ?? topAgent.uaid;
  
  console.log(`\n📋 Getting details for: ${uaid}`);
  const agent = await client.resolveUaid(uaid);
  console.log(`  Name: ${agent.profile?.display_name ?? agent.name}`);
  console.log(`  Protocol: ${agent.protocol}`);
  console.log(`  Registry: ${agent.registry}`);

  // 3. Start conversation (requires API key)
  if (process.env.REGISTRY_BROKER_API_KEY) {
    console.log('\n💬 Starting conversation...');
    try {
      const session = await client.createChatSession({ uaid });
      console.log(`  Session: ${session.sessionId}`);

      const response = await client.sendChatMessage({
        sessionId: session.sessionId,
        message: 'Hello! What can you help me with?',
      });
      console.log(`  Response: ${response.response}`);

      // End session
      await client.endChatSession(session.sessionId);
      console.log('  Session ended.');
    } catch (e) {
      console.log(`  Chat error: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    console.log('\nℹ️  Add REGISTRY_BROKER_API_KEY to .env to enable chat');
    console.log('   Get your key at https://hol.org/registry');
  }
}

main().catch(console.error);
