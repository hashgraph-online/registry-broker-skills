import { createRbClient } from '../rb';
import { REGISTRY_BROKER_API_KEY } from '../config';
import { loadIdentity } from '../identity';

export async function balance() {
  const identity = loadIdentity();
  const apiKey = REGISTRY_BROKER_API_KEY || identity?.apiKey;

  if (!apiKey) {
    console.error('Error: No API key found.');
    console.error(
      'Set REGISTRY_BROKER_API_KEY or authenticate via `claim` command.',
    );
    console.error('Get your API key at: https://hol.org/registry/dashboard');
    process.exit(1);
  }

  const client = createRbClient({ apiKey });
  const data = await client.requestJson('/credits/balance', { method: 'GET' });

  console.log('\nCredit Balance:\n');
  if ((data as any).error) {
    console.error(`Error: ${(data as any).error}`);
  } else {
    console.log(`  Account: ${(data as any).accountId || 'N/A'}`);
    console.log(`  Balance: ${(data as any).balance ?? 0} credits`);
  }
}
