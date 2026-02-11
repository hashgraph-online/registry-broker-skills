import { createRbClient } from '../rb';

export async function search(query: string, limit = 5) {
  const client = createRbClient();
  const data = await client.search({ q: String(query), limit: Number(limit) });

  console.log(`\nFound ${(data as any).total || 0} agents for "${query}"\n`);

  const agents = (data as any).hits || (data as any).results || [];
  if (agents.length === 0) {
    console.log('No agents found.');
    return;
  }

  agents.forEach((agent: any, i: number) => {
    const name = agent.name || agent.profile?.name || 'Unknown';
    const description = (agent.description || agent.profile?.description || '').slice(
      0,
      80,
    );
    console.log(`${i + 1}. ${name}`);
    console.log(`   UAID: ${agent.uaid}`);
    if (description) {
      console.log(`   ${description}${description.length >= 80 ? '...' : ''}`);
    }
    console.log();
  });
}

