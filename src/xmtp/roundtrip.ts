import path from 'path';

import { BASE_URL, REGISTRY_BROKER_API_KEY } from '../config';
import { KEY_DIR } from '../paths';
import { createRbClient, requestJsonSafe } from '../rb';
import { ensureBrokerApiKey } from '../auth';
import { getOrCreateIdentity } from '../identity';
import { createXmtpClientForUaid, sendXmtpMessage, waitForXmtpMessage } from './client';
import { ingestChatMessage } from './ingest';
import { ensureStagingAgentsSeeded } from './staging';
import { getString, isRecord } from '../utils/guards';

export async function xmtpRoundtrip(
  fromUaid: string,
  toUaid: string,
  message: string,
  options: {
    reply?: string;
    title?: string;
    tags?: string;
    categories?: string;
  } = {},
) {
  const identity = getOrCreateIdentity();
  const apiKey = REGISTRY_BROKER_API_KEY || (await ensureBrokerApiKey(identity));
  const client = createRbClient({ apiKey });

  const claimed = new Set(
    Array.isArray(identity?.claimedAgents) ? identity.claimedAgents : [],
  );
  if (!claimed.has(fromUaid) || !claimed.has(toUaid)) {
    throw new Error(
      'XMTP roundtrip requires both UAIDs to be claimed in your local identity.',
    );
  }

  await ensureStagingAgentsSeeded({ client, uaids: [fromUaid, toUaid] });

  const createdRes = await requestJsonSafe(client, '/chat/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { uaid: fromUaid, transport: 'moltbook', senderUaid: fromUaid },
  });
  const createdData = isRecord(createdRes.data) ? createdRes.data : null;
  const createdSessionId = createdData ? getString(createdData.sessionId) : null;
  if (!createdRes.ok || !createdSessionId) {
    const apiError =
      createdData && typeof createdData.error !== 'undefined'
        ? String(createdData.error)
        : null;
    const clientError = !createdRes.ok ? createdRes.error : null;
    const msg = apiError ?? clientError ?? `HTTP ${createdRes.status}`;
    throw new Error(`Failed to create session: ${msg}`);
  }
  const sessionId = createdSessionId;

  const invitedRes = await requestJsonSafe(
    client,
    `/chat/session/${encodeURIComponent(sessionId)}/invite`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { senderUaid: fromUaid, uaid: toUaid, historyScope: 'all' },
    },
  );
  if (!invitedRes.ok) {
    const msg =
      invitedRes?.data &&
      typeof invitedRes.data === 'object' &&
      'error' in invitedRes.data &&
      (invitedRes.data as any).error
        ? String((invitedRes.data as any).error)
        : invitedRes.error || `HTTP ${invitedRes.status}`;
    throw new Error(`Failed to invite member: ${msg}`);
  }

  const patchBody: Record<string, unknown> = {
    senderUaid: fromUaid,
    visibility: 'public',
  };
  if (typeof options.title === 'string') patchBody.title = options.title;
  if (typeof options.tags === 'string') patchBody.tags = options.tags;
  if (typeof options.categories === 'string') patchBody.categories = options.categories;

  const patchedRes = await requestJsonSafe(
    client,
    `/chat/session/${encodeURIComponent(sessionId)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: patchBody,
    },
  );
  if (!patchedRes.ok) {
    const msg =
      patchedRes?.data &&
      typeof patchedRes.data === 'object' &&
      'error' in patchedRes.data &&
      (patchedRes.data as any).error
        ? String((patchedRes.data as any).error)
        : patchedRes.error || `HTTP ${patchedRes.status}`;
    throw new Error(`Failed to set session public: ${msg}`);
  }

  const dbDir = path.join(KEY_DIR, 'xmtp');
  const timeoutMs = 180000;

  const seed = identity.privateKey;
  const sender1 = await createXmtpClientForUaid({ seed, uaid: fromUaid, dbDir });
  const receiver1 = await createXmtpClientForUaid({ seed, uaid: toUaid, dbDir });

  const since1 = Date.now() - 2000;
  await sendXmtpMessage({
    sender: sender1.client,
    recipientAddress: receiver1.address,
    message,
    timeoutMs,
  });
  await waitForXmtpMessage({
    receiver: receiver1.client,
    peerAddress: sender1.address,
    sinceMs: since1,
    timeoutMs,
    expectedContent: message,
  });
  await ingestChatMessage({
    client,
    sessionId,
    senderUaid: fromUaid,
    recipientUaid: toUaid,
    content: message,
  });

  const reply =
    typeof options.reply === 'string' && options.reply.trim().length > 0
      ? options.reply.trim()
      : `PONG: Received "${message}"`;

  const since2 = Date.now() - 2000;
  await sendXmtpMessage({
    sender: receiver1.client,
    recipientAddress: sender1.address,
    message: reply,
    timeoutMs,
  });
  await waitForXmtpMessage({
    receiver: sender1.client,
    peerAddress: receiver1.address,
    sinceMs: since2,
    timeoutMs,
    expectedContent: reply,
  });
  await ingestChatMessage({
    client,
    sessionId,
    senderUaid: toUaid,
    recipientUaid: fromUaid,
    content: reply,
  });

  const webBase = BASE_URL.endsWith('/api/v1')
    ? BASE_URL.slice(0, -'/api/v1'.length)
    : BASE_URL;
  const publicUrlCandidates = [
    `${webBase}/chats/public/${sessionId}`,
    `${webBase}/registry/chats/public/${sessionId}`,
  ];

  return {
    sessionId,
    publicUrlCandidates,
    members: (invitedRes as any)?.data?.members || null,
  };
}
