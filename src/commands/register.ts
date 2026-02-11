import { REGISTRY_BROKER_API_KEY } from '../config';
import { createRbClient } from '../rb';
import { loadIdentity } from '../identity';

export async function registerOwnedAgent(
  uaid: string,
  options: {
    json?: boolean;
    name?: string | null;
    description?: string | null;
    endpoint?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
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

  const payload: Record<string, unknown> = {
    registered: true,
    ...(options?.name ? { name: options.name } : {}),
    ...(options?.description ? { description: options.description } : {}),
    ...(options?.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options?.metadata ? { metadata: options.metadata } : {}),
  };

  let data: any = null;
  try {
    data = await client.requestJson(`/register/${encodeURIComponent(uaid)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }

  if (options?.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log('\nAgent marked as registered.\n');
  if (data.uaid) {
    console.log(`  UAID: ${data.uaid}`);
  }
  if (data.registeredAt) {
    console.log(`  Registered At: ${data.registeredAt}`);
  }
  if (data.agent?.name) {
    console.log(`  Name: ${data.agent.name}`);
  }
  if (data.agent?.description) {
    console.log(`  Description: ${data.agent.description}`);
  }
  console.log();
}

export async function registerStatus(
  uaid: string,
  options: { json?: boolean } = {},
) {
  const client = createRbClient();
  let data: any = null;
  try {
    data = await client.requestJson(
      `/register/status/${encodeURIComponent(uaid)}`,
      { method: 'GET' },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }

  if (options?.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log('\nBroker registration status:\n');
  console.log(`  Registered: ${data.registered ? 'Yes' : 'No'}`);
  const registeredAt = data.agent?.metadata?.registeredAt;
  if (registeredAt) {
    console.log(`  Registered At: ${registeredAt}`);
  }
  console.log();
}

