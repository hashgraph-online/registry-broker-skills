import { createRbClient } from '../rb';

export async function stats() {
  const client = createRbClient();
  const data = await client.stats();

  console.log('\nRegistry Statistics:\n');
  console.log(JSON.stringify(data, null, 2));
}

