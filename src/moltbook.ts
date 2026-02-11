import { createRbClient } from './rb';
import { REGISTRY_BROKER_API_KEY } from './config';
import { ensureBrokerApiKey, authenticateWithLedger } from './auth';
import {
  getOrCreateIdentity,
  loadIdentity,
  saveIdentity,
  type Identity,
} from './identity';
import { KEY_FILE } from './paths';

const MOLTBOOK_API_BASE = 'https://www.moltbook.com/api/v1';

const VERIFICATION_THREAD_ID = '19832203-36d9-439e-8583-ba3a7b5cbd78';

async function getMoltbookAgentProfile(apiKey: string) {
  const response = await fetch(`${MOLTBOOK_API_BASE}/agents/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as any;
  const agent = payload?.agent ?? payload;
  return {
    id: agent?.id,
    name: agent?.name,
    description: agent?.description,
  };
}

async function createMoltbookVerificationComment(
  apiKey: string,
  code: string,
  agentName: string,
) {
  const response = await fetch(
    `${MOLTBOOK_API_BASE}/posts/${VERIFICATION_THREAD_ID}/comments`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        content: `Verification: ${code}\nAgent: ${agentName}`,
      }),
    },
  );

  const payload = (await response.json()) as any;

  if (!response.ok || payload.error) {
    return { error: payload.error ?? `HTTP ${response.status}` };
  }

  return {
    commentId: payload.comment?.id,
    threadUrl: `https://www.moltbook.com/m/hol-verification/post/${VERIFICATION_THREAD_ID}`,
  };
}

async function createMoltbookVerificationPost(
  apiKey: string,
  code: string,
  agentName: string,
) {
  const response = await fetch(`${MOLTBOOK_API_BASE}/posts`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      title: 'HOL Registry Ownership Verification',
      content: `Verification code: ${code}\n\nThis post proves ownership of the agent "${agentName}" for HOL Registry Broker.`,
      submolt: 'hol-verification',
    }),
  });

  const payload = (await response.json()) as any;

  if (!response.ok || payload.error) {
    return { error: payload.error ?? `HTTP ${response.status}` };
  }

  return {
    postId: payload.post?.id,
    postUrl: payload.post?.url,
  };
}

export async function claimWithApiKey(moltbookApiKey: string) {
  console.log('\nClaiming agent ownership using Moltbook API key...\n');

  console.log('Step 1: Fetching your agent profile from Moltbook...');
  const agentProfile = await getMoltbookAgentProfile(moltbookApiKey);

  if (!agentProfile || !agentProfile.name) {
    console.error(
      'Error: Invalid Moltbook API key or unable to fetch agent profile.',
    );
    console.log(
      '\nMake sure your API key is valid. Get it from: https://www.moltbook.com/settings/api',
    );
    process.exit(1);
  }

  console.log(`  Agent: ${agentProfile.name}`);

  const resolveMoltbookUaid = async (handle: string) => {
    const client = createRbClient();
    const data = await client.search({
      q: String(handle),
      registries: ['moltbook'],
      limit: 10,
    });
    const agents = (data as any)?.hits || (data as any)?.results || [];
    const normalized = String(handle).toLowerCase();
    const exact = agents.find((agent: any) => {
      const name = (agent.name || agent.profile?.name || '').toLowerCase();
      return name === normalized;
    });
    return exact?.uaid || null;
  };

  const uaid = await resolveMoltbookUaid(agentProfile.name);
  if (!uaid) {
    console.error(
      'Error: Unable to resolve UAID for this Moltbook agent via the broker index.',
    );
    console.log(
      'Make sure the agent exists in the broker index (or register it first), then retry.\n',
    );
    process.exit(1);
  }
  console.log(`  UAID: ${uaid}\n`);

  const identity = getOrCreateIdentity();

  const apiKey = REGISTRY_BROKER_API_KEY || (await ensureBrokerApiKey(identity));
  const brokerClient = createRbClient({ apiKey });

  let ownershipData: any = null;
  try {
    ownershipData = await brokerClient.getVerificationOwnership(uaid);
  } catch {
    ownershipData = null;
  }

  if (ownershipData && (ownershipData.ownerId || ownershipData.ownerHandle)) {
    const currentPrincipalIsLedger =
      identity.apiKey && identity.apiKey.startsWith('rbk_');
    const ownershipIsApiKey = ownershipData.ownerType === 'api-key';
    const ownershipIsLedger = ownershipData.ownerType === 'ledger';
    const ownershipMatchesCurrentIdentity =
      ownershipIsLedger &&
      ownershipData.ownerId?.toLowerCase() === identity.address?.toLowerCase();

    if (ownershipMatchesCurrentIdentity) {
      console.log('This agent is already verified with your identity!');
      console.log(
        `  Owner: ${ownershipData.ownerHandle || ownershipData.ownerId}`,
      );
      console.log(`  Verified: ${ownershipData.verifiedAt}\n`);

      if (!identity.claimedAgents) identity.claimedAgents = [];
      if (!identity.claimedAgents.includes(uaid)) {
        identity.claimedAgents.push(uaid);
        saveIdentity(identity);
        console.log('  (Added to your claimed agents list)\n');
      }

      console.log('You can chat with this agent as a user:');
      console.log(`  npx @hol-org/registry chat ${uaid} "Hello!"`);
      console.log('To send as this agent (advanced):');
      console.log(`  npx @hol-org/registry chat --as ${uaid} ${uaid} "Hello!"`);
      return;
    } else if (
      currentPrincipalIsLedger &&
      (ownershipIsApiKey || ownershipIsLedger)
    ) {
      console.log('Agent was previously verified with a different identity.');
      console.log(`  Previous owner: ${ownershipData.ownerId}`);
      console.log('Re-verifying with your current ledger identity...\n');
    }
  }

  console.log('Step 2: Creating verification challenge...');
  let challenge: any = null;
  try {
    challenge = await brokerClient.createVerificationChallenge(uaid);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error creating challenge:', message);
    process.exit(1);
  }

  console.log(`  Challenge code: ${challenge.code}\n`);

  console.log('Step 3: Creating verification comment on master thread...');
  const commentResult = await createMoltbookVerificationComment(
    moltbookApiKey,
    challenge.code,
    agentProfile.name,
  );

  if ((commentResult as any).error) {
    console.log(
      `  Comment failed (${(commentResult as any).error}), trying post fallback...`,
    );
    const postResult = await createMoltbookVerificationPost(
      moltbookApiKey,
      challenge.code,
      agentProfile.name,
    );

    if ((postResult as any).error) {
      console.error(`Error creating post: ${(postResult as any).error}`);
      console.log(
        '\nYou may need to wait 20 seconds between comments (or 30 minutes between posts).',
      );
      console.log('Try again later, or use the manual flow:');
      console.log(`  npx @hol-org/registry claim ${uaid}`);
      process.exit(1);
    }

    console.log(`  Post created: ${(postResult as any).postUrl || (postResult as any).postId}\n`);
  } else {
    console.log('  Comment created on master thread\n');
    console.log(`  Thread: ${(commentResult as any).threadUrl}\n`);
  }

  console.log('Step 4: Verifying with broker (searching for your post)...');
  let verifyData: any = null;
  try {
    verifyData = await brokerClient.verifyVerificationChallenge({
      challengeId: challenge.challengeId,
      method: 'moltbook-post',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Verification failed:', message);
    console.log(
      '\nThe broker could not find your post. This might be a timing issue.',
    );
    console.log('Wait a few seconds and try completing manually:');
    console.log(
      `  npx @hol-org/registry claim ${uaid} --complete ${challenge.challengeId}`,
    );
    process.exit(1);
  }

  console.log('\n================================================================================');
  console.log('SUCCESS! Agent ownership verified!');
  console.log('================================================================================\n');
  console.log(`  Agent: ${agentProfile.name}`);
  console.log(`  UAID: ${verifyData.uaid || uaid}`);
  console.log(`  Owner: ${verifyData.ownerHandle || verifyData.ownerId || 'unknown'}`);
  console.log('  Proof: Comment on m/hol-verification master thread\n');

  if (!identity.claimedAgents) identity.claimedAgents = [];
  if (!identity.claimedAgents.includes(uaid)) identity.claimedAgents.push(uaid);
  saveIdentity(identity);

  console.log('You can now chat with this agent:');
  console.log(`  npx @hol-org/registry chat ${uaid} "Hello!"\n`);
}

export async function claim(uaid: string) {
  console.log(`\nClaiming ownership of: ${uaid}\n`);

  const identity = getOrCreateIdentity();
  const apiKey = REGISTRY_BROKER_API_KEY || (await ensureBrokerApiKey(identity));
  const brokerClient = createRbClient({ apiKey });

  let ownershipData: any = null;
  try {
    ownershipData = await brokerClient.getVerificationOwnership(uaid);
  } catch {
    ownershipData = null;
  }

  if (ownershipData && (ownershipData.ownerId || ownershipData.ownerHandle)) {
    console.log('This agent is already claimed.');
    console.log(`  Owner: ${ownershipData.ownerHandle || ownershipData.ownerId}`);
    console.log(`  Verified: ${ownershipData.verifiedAt}`);
    return;
  }

  console.log('Creating verification challenge...');
  let challenge: any = null;
  try {
    challenge = await brokerClient.createVerificationChallenge(uaid);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exit(1);
  }

  console.log(`\nChallenge Code: ${challenge.code}`);
  console.log(`Expires: ${challenge.expiresAt}\n`);

  console.log('================================================================================');
  console.log('TO COMPLETE VERIFICATION:');
  console.log('================================================================================\n');
  const expectedHandle =
    typeof challenge.expectedHandle === 'string' &&
    challenge.expectedHandle.trim().length > 0
      ? challenge.expectedHandle.trim()
      : uaid;
  console.log(`1. Post this exact code on Moltbook using your agent "${expectedHandle}":`);
  console.log(`\n   ${challenge.code}\n`);
  console.log(`   (You can post as a comment on the master thread: https://moltbook.com/m/hol-verification/post/${VERIFICATION_THREAD_ID})\n`);
  console.log('2. After posting, run:');
  console.log(`\n   npx @hol-org/registry claim ${uaid} --complete ${challenge.challengeId}\n`);
  console.log('================================================================================\n');

  (identity as any).pendingChallenge = {
    challengeId: challenge.challengeId,
    code: challenge.code,
    uaid,
    expiresAt: challenge.expiresAt,
  };
  saveIdentity(identity);
}

export async function claimComplete(uaid: string, challengeId: string) {
  const identity = loadIdentity() as (Identity & Record<string, any>) | null;
  if (!identity) {
    console.error('No identity found. Run "claim" first.');
    process.exit(1);
  }

  console.log(`\nCompleting verification for: ${uaid}\n`);

  if (!REGISTRY_BROKER_API_KEY && !identity.apiKey) {
    if (identity.privateKey) {
      await authenticateWithLedger(identity);
    }
  }

  const apiKey = REGISTRY_BROKER_API_KEY || (await ensureBrokerApiKey(identity));
  const brokerClient = createRbClient({ apiKey });

  let data: any = null;
  try {
    data = await brokerClient.verifyVerificationChallenge({
      challengeId,
      method: 'moltbook-post',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Verification failed:', message);
    console.log('\nMake sure you posted the challenge code on Moltbook using your agent.');
    process.exit(1);
  }

  if (data.error) {
    console.error('Verification failed:', data.error);
    console.log('\nMake sure you posted the challenge code on Moltbook using your agent.');
    process.exit(1);
  }

  console.log('Verification successful!');
  console.log(`  UAID: ${data.uaid}`);
  console.log(`  Owner: ${data.ownerHandle || data.ownerId || 'unknown'}\n`);

  if (!identity.claimedAgents) {
    identity.claimedAgents = [];
  }
  if (!identity.claimedAgents.includes(uaid)) {
    identity.claimedAgents.push(uaid);
  }
  delete identity.pendingChallenge;
  saveIdentity(identity);

  console.log('You can now chat with this agent:');
  console.log(`  npx @hol-org/registry chat ${uaid} "Hello!"`);
}

export async function whoami() {
  const identity = loadIdentity() as (Identity & Record<string, any>) | null;

  if (!identity) {
    console.log('\nNo identity found.');
    console.log('Run "claim <uaid>" to create an identity and claim your first agent.\n');
    return;
  }

  console.log('\nYour Identity:');
  console.log(`  Address: ${identity.address}`);
  console.log(`  Created: ${identity.createdAt}`);
  console.log(`  Stored at: ${KEY_FILE}`);

  if (identity.claimedAgents && identity.claimedAgents.length > 0) {
    console.log('\nClaimed Agents:');
    for (const uaid of identity.claimedAgents) {
      console.log(`  - ${uaid}`);
    }
  } else {
    console.log('\nNo claimed agents yet.');
    console.log('Run "claim <uaid>" to claim ownership of your Moltbook agent.');
  }

  if (identity.pendingChallenge) {
    console.log('\nPending Challenge:');
    console.log(`  UAID: ${identity.pendingChallenge.uaid}`);
    console.log(`  Code: ${identity.pendingChallenge.code}`);
    console.log(`  Expires: ${identity.pendingChallenge.expiresAt}`);
    console.log(
      `\nTo complete: npx @hol-org/registry claim ${identity.pendingChallenge.uaid} --complete ${identity.pendingChallenge.challengeId}`,
    );
  }

  console.log();
}

export async function refreshKey() {
  const identity = loadIdentity();

  if (!identity) {
    console.log('\nNo identity found.');
    console.log('Run "claim <uaid>" to create an identity first.\n');
    return;
  }

  console.log('\nRefreshing API key...');

  delete (identity as any).apiKey;
  delete (identity as any).apiKeyBaseUrl;
  saveIdentity(identity as any);

  try {
    const newKey = await authenticateWithLedger(identity as any);
    console.log('API key refreshed successfully.');
    console.log(`  New key: ${newKey.slice(0, 12)}...${newKey.slice(-8)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to refresh key: ${message}`);
    process.exit(1);
  }
}

