import type { RegistryBrokerClient } from '@hol-org/rb-client';

import { BASE_URL } from '../config';
import { requestJsonSafe } from '../rb';
import { getBoolean, getRecord } from '../utils/guards';

function isStagingRegistryBroker(baseUrl: string) {
  const normalized = typeof baseUrl === 'string' ? baseUrl.trim().toLowerCase() : '';
  return normalized.includes('registry-staging.hol.org');
}

const STAGING_SEED_AGENT_DEFAULTS: Record<
  string,
  { name: string; description: string; registry: string }
> = {
  'uaid:aid:7GC1CQGrn4ftBpDFPiwPtxvV1FNb3zNvuQm7Q59ieNSeGdzaE8hYacaFUhxCo1HvjC':
    {
      name: 'RegistryBrokerBot',
      description: 'Official Registry Broker bot (staging seed).',
      registry: 'moltbook',
    },
  'uaid:aid:4kzQdSo3RXYrYQ4BB3uU7mteUygAkedZZMDUEnn4tB4CErh4bG8HW5ykqxpvmnmeBK':
    {
      name: 'kantorcodes',
      description: 'Demo agent identity for staging roundtrips.',
      registry: 'moltbook',
    },
};

export async function ensureStagingAgentsSeeded({
  client,
  uaids,
}: {
  client: RegistryBrokerClient;
  uaids: string[];
}) {
  if (!isStagingRegistryBroker(BASE_URL)) {
    return { seeded: false } as const;
  }

  const needsSeed: string[] = [];
  for (const uaid of uaids) {
    const resolved = await requestJsonSafe(
      client,
      `/resolve/${encodeURIComponent(uaid)}`,
      { method: 'GET' },
    );
    if (!resolved.ok && resolved.status === 404) {
      needsSeed.push(uaid);
      continue;
    }

    const status = await requestJsonSafe(
      client,
      `/verification/status/${encodeURIComponent(uaid)}`,
      { method: 'GET' },
    );
    const statusRecord = getRecord(status.data);
    const verified = statusRecord ? getBoolean(statusRecord.verified) : null;
    if (!status.ok || verified !== true) {
      needsSeed.push(uaid);
    }
  }

  if (needsSeed.length === 0) {
    return { seeded: false } as const;
  }

  const payload = {
    agents: uaids.map((uaid) => {
      const defaults = STAGING_SEED_AGENT_DEFAULTS[uaid] ?? null;
      const shortName =
        uaid.length > 18 ? `${uaid.slice(0, 10)}…${uaid.slice(-6)}` : uaid;
      return {
        uaid,
        name: defaults?.name ?? shortName,
        registry: defaults?.registry ?? 'moltbook',
        description: defaults?.description ?? 'Staging seed agent record.',
      };
    }),
  };

  const res = await requestJsonSafe(client, '/agents/seed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
  });

  if (!res.ok) {
    const dataRecord = getRecord(res.data);
    const message =
      dataRecord && typeof dataRecord.error !== 'undefined'
        ? String(dataRecord.error)
        : res.error || `HTTP ${res.status}`;
    throw new Error(`Failed to seed staging agents: ${message}`);
  }

  return { seeded: true, result: res.data } as const;
}
