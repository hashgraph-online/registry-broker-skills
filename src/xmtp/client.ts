import path from 'path';

import { hexToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { ensureDirSync } from '../utils/fs';
import { deriveXmtpPrivateKeyFromUaid } from './derive';
import { loadXmtpNodeSdk, resolveXmtpEnv } from './sdk';

export async function createXmtpClientForUaid({
  seed,
  uaid,
  dbDir,
}: {
  seed: string;
  uaid: string;
  dbDir: string;
}) {
  const xmtp = await loadXmtpNodeSdk();
  const privateKey = deriveXmtpPrivateKeyFromUaid({ uaid, seed });
  const account = privateKeyToAccount(privateKey);
  const env = resolveXmtpEnv();

  ensureDirSync(dbDir);
  const dbPath = path.join(
    dbDir,
    `xmtp-uaid-${account.address.toLowerCase()}-${env}.db`,
  );

  const signer = {
    type: 'EOA' as const,
    signMessage: async (message: string) => {
      const signature = await account.signMessage({ message });
      return hexToBytes(signature);
    },
    getIdentifier: () => ({
      identifier: account.address,
      identifierKind: xmtp.IdentifierKind.Ethereum,
    }),
  };

  const client = await xmtp.Client.create(signer, { env, dbPath });

  if (!client.isRegistered) {
    try {
      await client.register();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (new RegExp('10/10 installations', 'i').test(message)) {
        await client.revokeAllOtherInstallations();
        await client.register();
      } else {
        throw err;
      }
    }
  }

  try {
    await client.revokeAllOtherInstallations();
  } catch {
    // ignore
  }

  try {
    await client.conversations.syncAll([
      xmtp.ConsentState.Unknown,
      xmtp.ConsentState.Allowed,
    ]);
  } catch {
    // ignore
  }

  return { client, address: account.address, inboxId: client.inboxId };
}

export async function waitForXmtpMessage({
  receiver,
  peerAddress,
  sinceMs,
  timeoutMs,
  expectedContent,
}: {
  receiver: any;
  peerAddress: string;
  sinceMs: number;
  timeoutMs: number;
  expectedContent?: string | null;
}) {
  const xmtp = await loadXmtpNodeSdk();
  const deadline = Date.now() + timeoutMs;

  const identifier = {
    identifier: peerAddress,
    identifierKind: xmtp.IdentifierKind.Ethereum,
  };

  const dm = await receiver.conversations.newDmWithIdentifier(identifier);
  if (dm.consentState === xmtp.ConsentState.Unknown) {
    dm.updateConsentState(xmtp.ConsentState.Allowed);
  }

  const expectedTrimmed =
    typeof expectedContent === 'string' && expectedContent.trim().length > 0
      ? expectedContent.trim()
      : null;

  const parseSentAtMs = (value: unknown) => {
    if (!value) return Number.NaN;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return Number.NaN;
  };

  const parseSentAtNsToMs = (value: unknown) => {
    if (typeof value === 'bigint') return Number(value / 1000000n);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.floor(value / 1_000_000);
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return Number.NaN;
      return Math.floor(parsed / 1_000_000);
    }
    return Number.NaN;
  };

  const minSentAtMs = sinceMs - 60_000;

  while (Date.now() < deadline) {
    try {
      await receiver.conversations.syncAll([
        xmtp.ConsentState.Unknown,
        xmtp.ConsentState.Allowed,
      ]);
    } catch {
      // ignore
    }

    try {
      await dm.sync();
    } catch {
      // ignore
    }

    let messages: any[] = [];
    try {
      messages = await dm.messages({ limit: 25 });
    } catch {
      messages = [];
    }

    for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
      const received = messages[idx];
      if (!received) continue;
      if (received.senderInboxId === receiver.inboxId) continue;
      const content =
        typeof received.content === 'string'
          ? received.content
          : String(received.content);
      if (expectedTrimmed && content.trim() !== expectedTrimmed) continue;

      const sentAtMs =
        parseSentAtMs(received.sentAt) ||
        parseSentAtMs(received.sentAtMs) ||
        parseSentAtNsToMs(received.sentAtNs);
      if (Number.isFinite(sentAtMs) && sentAtMs <= minSentAtMs) continue;

      return { conversationId: dm.id, message: content, sentAtMs };
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error('Timed out waiting for XMTP message');
}

export async function sendXmtpMessage({
  sender,
  recipientAddress,
  message,
  timeoutMs,
}: {
  sender: any;
  recipientAddress: string;
  message: string;
  timeoutMs: number;
}) {
  const xmtp = await loadXmtpNodeSdk();
  const identifier = {
    identifier: recipientAddress,
    identifierKind: xmtp.IdentifierKind.Ethereum,
  };

  const deadline = Date.now() + timeoutMs;
  let canMessage = false;
  while (Date.now() < deadline) {
    try {
      const result = await sender.canMessage([identifier]);
      const raw = identifier.identifier;
      const normalized = raw.toLowerCase();
      canMessage = Boolean(result.get(raw) ?? result.get(normalized));
    } catch {
      canMessage = false;
    }
    if (canMessage) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!canMessage) {
    throw new Error(`XMTP recipient ${recipientAddress} is not messageable yet`);
  }

  const dm = await sender.conversations.newDmWithIdentifier(identifier);
  try {
    await dm.sync();
  } catch {
    // ignore
  }
  if (dm.consentState === xmtp.ConsentState.Unknown) {
    dm.updateConsentState(xmtp.ConsentState.Allowed);
  }
  await dm.send(message);
  try {
    await dm.publishMessages();
  } catch {
    // ignore
  }
  return { conversationId: dm.id };
}
