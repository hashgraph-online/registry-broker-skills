import { RegistryBrokerClient, RegistryBrokerError } from '@hol-org/rb-client';
import { BASE_URL } from './config';

export function createRbClient({ apiKey }: { apiKey?: string } = {}) {
  return new RegistryBrokerClient({
    baseUrl: BASE_URL,
    ...(apiKey ? { apiKey } : {}),
  });
}

export async function requestJsonSafe(
  client: RegistryBrokerClient,
  path: string,
  config: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; data: unknown; error: string }
> {
  try {
    const data = await client.requestJson(path, config);
    return { ok: true, status: 200, data };
  } catch (err) {
    if (err instanceof RegistryBrokerError) {
      return {
        ok: false,
        status: err.status,
        data: err.body ?? null,
        error: err.message,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, data: null, error: message };
  }
}
