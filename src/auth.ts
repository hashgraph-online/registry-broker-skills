import { privateKeyToAccount } from 'viem/accounts';

import { BASE_URL, REGISTRY_BROKER_API_KEY } from './config';
import { createRbClient, requestJsonSafe } from './rb';
import { getIdentityApiKey, saveIdentity, type Identity } from './identity';

export async function authenticateWithLedger(
  identity: Identity,
  options: { force?: boolean } = {},
) {
  const force = options.force === true;

  if (!force && identity.apiKey && identity.apiKeyBaseUrl === BASE_URL) {
    const probeClient = createRbClient({ apiKey: identity.apiKey });
    const probe = await requestJsonSafe(probeClient, '/credits/balance', {
      method: 'GET',
    });
    if (probe.ok) {
      return identity.apiKey;
    }
  }

  console.log('Authenticating with Registry Broker...');

  const envNetwork =
    typeof process.env.HOL_LEDGER_NETWORK === 'string' &&
    process.env.HOL_LEDGER_NETWORK.trim().length > 0
      ? process.env.HOL_LEDGER_NETWORK.trim()
      : null;
  const inferredNetwork =
    BASE_URL.includes('staging') ||
    BASE_URL.includes('localhost') ||
    BASE_URL.includes('127.0.0.1')
      ? 'base-sepolia'
      : 'base';
  const ledgerNetwork = envNetwork ?? inferredNetwork;

  const brokerClient = createRbClient();
  const account = privateKeyToAccount(identity.privateKey);
  const result = await brokerClient.authenticateWithLedger({
    accountId: identity.address,
    network: ledgerNetwork,
    sign: async (message) => ({
      signature: await account.signMessage({ message }),
      signatureKind: 'evm',
    }),
  });

  if (result.key) {
    identity.apiKey = result.key;
    identity.apiKeyBaseUrl = BASE_URL;
    saveIdentity(identity);
    console.log('  Authentication successful.\n');
    return result.key;
  }

  throw new Error('Failed to obtain API key from broker');
}

export async function ensureBrokerApiKey(identity: Identity) {
  const identityApiKey = getIdentityApiKey(identity);

  if (!identityApiKey) {
    await authenticateWithLedger(identity);
    const refreshed = getIdentityApiKey(identity);
    if (!refreshed) {
      throw new Error('No API key available for this broker base URL.');
    }
    return refreshed;
  }

  const probeClient = createRbClient({ apiKey: identityApiKey });
  const probe = await requestJsonSafe(probeClient, '/credits/balance', {
    method: 'GET',
  });
  if (!probe.ok && (probe.status === 401 || probe.status === 403)) {
    await authenticateWithLedger(identity);
    const refreshed = getIdentityApiKey(identity);
    if (!refreshed) {
      throw new Error('No API key available for this broker base URL.');
    }
    return refreshed;
  }

  return identityApiKey;
}

export function getBrokerHeaders(identity: Identity) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (REGISTRY_BROKER_API_KEY) {
    headers['x-api-key'] = REGISTRY_BROKER_API_KEY;
    return headers;
  }

  const identityApiKey = getIdentityApiKey(identity);
  if (identityApiKey) {
    headers['x-api-key'] = identityApiKey;
  }

  return headers;
}
