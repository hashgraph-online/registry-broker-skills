/**
 * Example: Ledger authentication with wallet
 * 
 * This example demonstrates wallet-based authentication:
 * 1. Request a challenge
 * 2. Sign the challenge (simulated)
 * 3. Verify and get temporary API key
 */

const BASE_URL = process.env.REGISTRY_BROKER_API_URL || 'https://hol.org/registry/api/v1';

async function main() {
  const accountId = process.env.HEDERA_ACCOUNT_ID || '0.0.12345';
  const network = 'hedera-testnet';

  // 1. Request challenge
  console.log(`Requesting challenge for ${accountId} on ${network}...\n`);
  
  const challengeResponse = await fetch(`${BASE_URL}/auth/ledger/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, network }),
  });
  
  const challenge = await challengeResponse.json();
  console.log('Challenge received:');
  console.log(`  Challenge ID: ${challenge.challengeId}`);
  console.log(`  Message to sign: ${challenge.challenge}`);
  console.log(`  Expires at: ${challenge.expiresAt}\n`);

  // 2. Sign the challenge
  // In a real implementation, you would sign this with your wallet
  console.log('Sign this message with your wallet:');
  console.log(`  "${challenge.challenge}"\n`);
  
  // Simulated signature (replace with actual wallet signature)
  const signature = 'YOUR_WALLET_SIGNATURE_HERE';
  const publicKey = 'YOUR_PUBLIC_KEY_HERE';
  
  if (signature === 'YOUR_WALLET_SIGNATURE_HERE') {
    console.log('Replace the signature and publicKey in this example with real values');
    console.log('from your wallet to complete authentication.\n');
    return;
  }

  // 3. Verify and get API key
  console.log('Verifying signature...\n');
  
  const verifyResponse = await fetch(`${BASE_URL}/auth/ledger/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      accountId,
      network,
      signature,
      publicKey,
      signatureKind: 'raw', // or 'map' or 'evm'
    }),
  });
  
  const result = await verifyResponse.json();
  
  if (result.apiKey) {
    console.log('Authentication successful!');
    console.log(`API Key: ${result.apiKey.key}`);
    console.log(`Expires: ${result.apiKey.expiresAt}`);
  } else {
    console.log('Authentication failed:', result);
  }
}

main().catch(console.error);
