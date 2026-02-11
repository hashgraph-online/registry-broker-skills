import fs from 'fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { BASE_URL } from './config';
import { KEY_DIR, KEY_FILE } from './paths';
import { ensureDirSync } from './utils/fs';

export type Identity = {
  address: string;
  privateKey: `0x${string}`;
  createdAt: string;
  chain: 'evm';
  claimedAgents: string[];
  imported?: boolean;
  apiKey?: string;
  apiKeyBaseUrl?: string;
};

function assertIsHexPrivateKey(value: string): asserts value is `0x${string}` {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    console.error('Error: Invalid private key format.');
    console.error('Expected: 64 hex characters (with or without 0x prefix)');
    process.exit(1);
  }
}

export function ensureKeyDir() {
  ensureDirSync(KEY_DIR);
}

export function loadIdentity(): Identity | null {
  if (!fs.existsSync(KEY_FILE)) {
    return null;
  }
  try {
    const content = fs.readFileSync(KEY_FILE, 'utf-8');
    return JSON.parse(content) as Identity;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity) {
  ensureKeyDir();
  fs.writeFileSync(KEY_FILE, JSON.stringify(identity, null, 2), { mode: 0o600 });
}

export function getIdentityApiKey(identity: Identity | null) {
  if (!identity?.apiKey) {
    return null;
  }
  if (
    typeof identity.apiKeyBaseUrl === 'string' &&
    identity.apiKeyBaseUrl !== BASE_URL
  ) {
    return null;
  }
  return identity.apiKey;
}

export function importPrivateKey(keyInput: string): Identity {
  let privateKey = keyInput.trim();

  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  assertIsHexPrivateKey(privateKey);

  try {
    const account = privateKeyToAccount(privateKey);

    const identity: Identity = {
      address: account.address,
      privateKey,
      createdAt: new Date().toISOString(),
      chain: 'evm',
      claimedAgents: [],
      imported: true,
    };

    saveIdentity(identity);
    console.log(`  Address: ${identity.address}`);
    console.log(`  Stored at: ${KEY_FILE}\n`);

    return identity;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error: Invalid private key.', message);
    process.exit(1);
  }
}

export function getOrCreateIdentity(): Identity {
  const existing = loadIdentity();
  if (existing) {
    return existing;
  }

  const envPrivateKey = process.env.HOL_PRIVATE_KEY;
  if (envPrivateKey) {
    console.log('Importing identity from HOL_PRIVATE_KEY...');
    return importPrivateKey(envPrivateKey);
  }

  console.log('Creating new identity...');

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const identity: Identity = {
    address: account.address,
    privateKey,
    createdAt: new Date().toISOString(),
    chain: 'evm',
    claimedAgents: [],
  };

  saveIdentity(identity);
  console.log(`  Address: ${identity.address}`);
  console.log(`  Stored at: ${KEY_FILE}\n`);

  return identity;
}
