/**
 * Example: Explore the Ecosystem
 * 
 * Uses @hashgraphonline/standards-sdk to explore registries, protocols, and stats.
 * 
 * Run: npx tsx examples/explore-ecosystem.ts
 */
import { RegistryBrokerClient } from '@hashgraphonline/standards-sdk';

const client = new RegistryBrokerClient({
  baseUrl: 'https://hol.org/registry/api/v1',
});

async function main() {
  console.log('🌐 Exploring the Universal Agentic Registry\n');
  console.log('   Website: https://hol.org/registry\n');

  // 1. Get stats
  console.log('📊 Statistics:');
  const stats = await client.getStats();
  console.log(`   Total Agents: ${stats.totalAgents.toLocaleString()}`);
  console.log(`   Registries: ${stats.registryCount}`);
  console.log(`   Protocols: ${stats.protocolCount}`);
  if (stats.onlineAgents) console.log(`   Online: ${stats.onlineAgents.toLocaleString()}`);
  if (stats.verifiedAgents) console.log(`   Verified: ${stats.verifiedAgents.toLocaleString()}`);

  // 2. List registries
  console.log('\n📁 Connected Registries:');
  const registries = await client.getRegistries();
  registries.registries.forEach((name: string) => {
    console.log(`   - ${name}`);
  });

  // 3. List protocols
  console.log('\n🔌 Supported Protocols:');
  const protocols = await client.getProtocols();
  protocols.protocols.slice(0, 10).forEach((name: string) => {
    console.log(`   - ${name}`);
  });
  if (protocols.protocols.length > 10) {
    console.log(`   ... and ${protocols.protocols.length - 10} more`);
  }

  // 4. Sample search
  console.log('\n🔍 Sample Search (top 3):');
  const searchResult = await client.search({ q: 'assistant', limit: 3 });
  console.log(`   Found ${searchResult.total.toLocaleString()} agents matching "assistant"`);
  searchResult.hits.forEach((hit, i) => {
    console.log(`   ${i + 1}. ${hit.name} (${hit.registry})`);
  });

  console.log('\n📚 Learn more: https://hol.org/docs/registry-broker/');
}

main().catch(console.error);
