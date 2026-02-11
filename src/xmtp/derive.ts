import { createHash, createHmac } from 'crypto';
import { privateKeyToAccount } from 'viem/accounts';

function assertIsHex64(value: string): asserts value is `0x${string}` {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('Invalid hex private key');
  }
}

function normalizeHex(hex: string) {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

function sha256(value: string) {
  const hash = createHash('sha256');
  hash.update(value, 'utf-8');
  return hash.digest();
}

function parseSeedBytes(seed: string) {
  const trimmed = typeof seed === 'string' ? seed.trim() : '';
  if (!trimmed) {
    throw new Error('XMTP seed is required');
  }

  const normalized = normalizeHex(trimmed);
  if (/^[a-fA-F0-9]{64}$/.test(normalized)) {
    return Buffer.from(normalized, 'hex');
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length >= 32) {
      return decoded.subarray(0, 32);
    }
  } catch {
    // ignore
  }

  return sha256(trimmed);
}

export function deriveXmtpPrivateKeyFromUaid({
  uaid,
  seed,
  domain = 'xmtp-uaid-v1',
}: {
  uaid: string;
  seed: string;
  domain?: string;
}): `0x${string}` {
  const uaidTrimmed = typeof uaid === 'string' ? uaid.trim() : '';
  if (!uaidTrimmed) {
    throw new Error('XMTP UAID derivation requires a UAID');
  }

  const seedBytes = parseSeedBytes(seed);
  const domainTrimmed =
    typeof domain === 'string' && domain.trim().length > 0
      ? domain.trim()
      : 'xmtp-uaid-v1';

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const digest = createHmac('sha256', seedBytes)
      .update(`${domainTrimmed}:${uaidTrimmed}:${attempt}`, 'utf-8')
      .digest();
    let privateKeyHex = `0x${digest.toString('hex')}`;
    try {
      assertIsHex64(privateKeyHex);
      privateKeyToAccount(privateKeyHex);
      return privateKeyHex;
    } catch {
      continue;
    }
  }
  throw new Error('XMTP UAID derivation failed to produce a valid private key');
}
