/**
 * Example: Register Your Agent
 * 
 * Uses @hashgraphonline/standards-sdk to register an agent on the universal registry.
 * 
 * Run: npx tsx examples/register-agent.ts
 */
import { 
  RegistryBrokerClient, 
  ProfileType, 
  AIAgentType, 
  AIAgentCapability,
  HCS11Profile 
} from '@hashgraphonline/standards-sdk';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.REGISTRY_BROKER_API_KEY) {
  console.error('❌ REGISTRY_BROKER_API_KEY required');
  console.log('   Get your key at https://hol.org/registry');
  process.exit(1);
}

const client = new RegistryBrokerClient({
  baseUrl: 'https://hol.org/registry/api/v1',
  apiKey: process.env.REGISTRY_BROKER_API_KEY,
});

async function main() {
  console.log('📝 Registering a new AI Agent...\n');

  const myAgentProfile: HCS11Profile = {
    version: '1.0',
    type: ProfileType.AI_AGENT,
    display_name: 'OpenClaw Demo Agent',
    alias: 'openclaw-demo-agent',
    bio: 'An example agent registered via the registry-broker-hashnet-openclaw skill.',
    avatarUrl: 'https://hol.org/favicon.ico',
    communicationEndpoint: 'https://my-agent.example.com/api/v1/chat',
    communicationProtocol: 'http/json',
    aiAgent: {
      type: AIAgentType.MANUAL,
      model: 'gpt-4-turbo',
      capabilities: [
        AIAgentCapability.TEXT_GENERATION,
        AIAgentCapability.WORKFLOW_AUTOMATION,
      ],
      creator: 'OpenClaw Skill Demo',
    },
    socials: [
      { platform: 'github', handle: 'hashgraphonline' },
    ],
    properties: {
      tags: ['demo', 'openclaw', 'typescript'],
    },
  };

  try {
    const result = await client.registerAgent({
      profile: myAgentProfile,
      endpoint: 'https://my-agent.example.com/api/v1/chat',
      communicationProtocol: 'a2a',
      registry: 'hashgraph-online',
      metadata: {
        provider: 'openclaw-demo',
      },
    });

    console.log('✅ Registration Successful!');
    console.log(`   UAID: ${result.uaid}`);
    console.log(`   Status: ${result.status}`);

    if (result.additionalRegistries?.length) {
      console.log('   Additional Registries:');
      result.additionalRegistries.forEach((reg) => {
        console.log(`     - ${reg.registry}: ${reg.status}`);
      });
    }
  } catch (error: any) {
    console.error('❌ Registration failed:', error.message);
    if (error.body) {
      console.error('   Details:', JSON.stringify(error.body, null, 2));
    }
  }
}

main().catch(console.error);
