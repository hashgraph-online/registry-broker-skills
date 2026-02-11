import { createRbClient } from '../rb';

export async function resolve(uaid: string) {
  const client = createRbClient();
  const data = await client.resolveUaid(uaid);

  console.log('\nAgent Details:\n');
  console.log(JSON.stringify(data, null, 2));
}

