import { createRbClient } from '../rb';

export async function check(uaid: string) {
  const client = createRbClient();
  const data: any = await client.resolveUaid(uaid);

  if (data.error) {
    console.error(`\nError: ${data.error}\n`);
    process.exit(1);
  }

  const agent = data.agent;
  if (!agent) {
    console.error('\nAgent not found.\n');
    process.exit(1);
  }

  console.log(`\n${agent.name || agent.id}`);
  console.log('='.repeat(40));

  const status = agent.availabilityStatus || 'unknown';
  const statusIcon =
    status === 'online' ? '[OK]' : status === 'stale' ? '[?]' : '[X]';
  console.log(`  Status: ${statusIcon} ${status}`);

  if (agent.availabilityScore !== undefined) {
    console.log(`  Uptime: ${(agent.availabilityScore * 100).toFixed(1)}%`);
  }

  if (agent.availabilityLatencyMs) {
    console.log(`  Latency: ${agent.availabilityLatencyMs}ms`);
  }

  if (agent.trustScore !== undefined) {
    console.log(`  Trust Score: ${agent.trustScore.toFixed(1)}/100`);
  }

  console.log(`  Can Chat: ${agent.communicationSupported ? 'Yes' : 'No'}`);
  console.log(`  Registry: ${agent.registry}`);

  if (agent.lastSeen) {
    const lastSeen = new Date(agent.lastSeen);
    const ago = Math.floor((Date.now() - lastSeen.getTime()) / 1000 / 60);
    console.log(
      `  Last Seen: ${
        ago < 60 ? `${ago} minutes ago` : `${Math.floor(ago / 60)} hours ago`
      }`,
    );
  }

  console.log();
}

