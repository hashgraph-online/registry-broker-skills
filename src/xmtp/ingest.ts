import type { RegistryBrokerClient } from '@hol-org/rb-client';

export async function ingestChatMessage({
  client,
  sessionId,
  senderUaid,
  recipientUaid,
  content,
}: {
  client: RegistryBrokerClient;
  sessionId: string;
  senderUaid: string;
  recipientUaid: string;
  content: string;
}) {
  const body = {
    senderUaid,
    recipientUaid,
    role: 'agent',
    content,
  };
  return await client.requestJson(
    `/chat/session/${encodeURIComponent(sessionId)}/ingest`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    },
  );
}

