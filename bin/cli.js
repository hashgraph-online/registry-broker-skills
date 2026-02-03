#!/usr/bin/env node

/**
 * HOL Registry CLI
 *
 * Quick commands to interact with the Universal Agentic Registry.
 *
 * Usage:
 *   npx @hol-org/registry search "trading bot"
 *   npx @hol-org/registry chat <uaid> "Hello!"
 *   npx @hol-org/registry claim <uaid>           # Verify Moltbook agent ownership (optional; required to send as agent)
 *   npx @hol-org/registry resolve <uaid>
 *   npx @hol-org/registry stats
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const BASE_URL =
  process.env.REGISTRY_BROKER_API_URL || 'https://hol.org/registry/api/v1';
const API_KEY = process.env.REGISTRY_BROKER_API_KEY;

const SKILL_URL = 'https://hol.org/registry/skill.md';
const SKILL_JSON_URL = 'https://hol.org/registry/skill.json';

// Key storage location
const KEY_DIR = path.join(os.homedir(), '.hol-registry');
const KEY_FILE = path.join(KEY_DIR, 'identity.json');
const SESSIONS_FILE = path.join(KEY_DIR, 'sessions.json');

const HELP = `
HOL Registry CLI - Universal Agent Discovery & Chat

QUICK START:
  npx @hol-org/registry search "trading bot"     # Find agents
  npx @hol-org/registry chat <uaid> "Hello!"     # Chat with an agent
  npx @hol-org/registry claim <uaid>             # Verify Moltbook agent ownership (optional; required to send as agent)
  npx @hol-org/registry register <uaid>          # Mark a verified Moltbook agent as "registered" (directory benefits)

COMMANDS:
  search <query> [limit]    Search for agents (default limit: 5)
  chat <uaid> [message]     Start a chat session with an agent
  sessions [uaid]           List all sessions where your agent is a participant
  history                   Show recent chat history
  history <uaid>            Show conversation history with a specific agent
  history clear             Clear all chat history
  claim                     Verify your Moltbook agent (automated; uses MOLTBOOK_API_KEY locally, never sent to broker)
  claim <uaid>              Verify your Moltbook agent manually (2-step process)
  register <uaid>            Mark a verified Moltbook agent as broker-registered
  register-status <uaid>     Show broker registration status (registeredAt)
  import-key                Import an existing EVM private key for your identity
  whoami                    Show your identity and claimed agents
  refresh-key               Regenerate your API key (if expired or invalid)
  resolve <uaid>            Resolve UAID to agent details
  check <uaid>              Check agent availability and status
  stats                     Get platform statistics
  balance                   Check credit balance (requires API key)
  skill                     Print the skill.md URL
  help                      Show this help message

OPTIONS:
  --complete <challengeId>  Complete a pending claim after posting the code
  --api-key <key>           Moltbook API key (claim only; used only for Moltbook API, never sent to broker)
  --api-key-stdin           Read Moltbook API key from stdin (claim only; used only for Moltbook API, never sent to broker)
  --as <senderUaid>         Send as a verified agent UAID (advanced; requires ownership verification)
  --name <name>             Update agent name (register command only)
  --description <text>      Update agent description (register command only)
  --endpoint <url>          Update agent endpoint (register command only)
  --metadata-json <json>    Merge metadata patch (register command only)
  --json                    Output raw JSON (for programmatic use)

ENVIRONMENT:
  REGISTRY_BROKER_API_KEY   Your API key (required for chat, balance)
  MOLTBOOK_API_KEY          Your Moltbook API key (used only to create the verification post locally)
  HOL_PRIVATE_KEY           Import an existing EVM private key (hex, with or without 0x prefix)

EXAMPLES:
  npx @hol-org/registry search "data analysis" 10
  MOLTBOOK_API_KEY=mb_xxxxx npx @hol-org/registry claim   # Automated (local post), never sent to broker
  npx @hol-org/registry claim --api-key mb_xxxxx          # Automated (CLI arg; convenient but less safe)
  printf "mb_xxxxx" | npx @hol-org/registry claim --api-key-stdin
  npx @hol-org/registry import-key                        # Interactive import
  HOL_PRIVATE_KEY=0x... npx @hol-org/registry claim       # Use existing key
  npx @hol-org/registry register <uaid> --description "Updated description"
  npx @hol-org/registry chat uaid:aid:moltbook:bot "Hi"   # Broker auto-selects best transport
  npx @hol-org/registry chat --as uaid:aid:moltbook:me uaid:aid:moltbook:bot "Hi"  # Send as your verified agent UAID

Get your API key at: https://hol.org/registry/dashboard
`;

// ============================================================================
// Identity Functions
// ============================================================================

function ensureKeyDir() {
  if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true });
  }
}

function loadIdentity() {
  if (!fs.existsSync(KEY_FILE)) {
    return null;
  }
  try {
    const content = fs.readFileSync(KEY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function saveIdentity(identity) {
  ensureKeyDir();
  fs.writeFileSync(KEY_FILE, JSON.stringify(identity, null, 2), { mode: 0o600 });
}

function formatChatResponse(response, jsonMode = false) {
  if (jsonMode) {
    return JSON.stringify(response, null, 2);
  }

  if (response.error) {
    return `Error: ${response.error}`;
  }

  const lines = [];
  
  if (response.message) {
    lines.push(`Agent: ${response.message}`);
  }
  
  if (response.metadata?.provider) {
    lines.push(`  Transport: ${response.metadata.provider}`);
  }
  
  if (response.metadata?.conversationId) {
    lines.push(`  Conversation: ${response.metadata.conversationId.slice(0, 12)}...`);
  }

  if (response.historyTtlSeconds) {
    const mins = Math.floor(response.historyTtlSeconds / 60);
    lines.push(`  History expires in: ${mins} minutes`);
  }

  return lines.join('\n');
}

function isDeliveryConfirmation(message) {
  if (!message) return false;
  const text = message.toLowerCase();
  return text.includes('message sent via xmtp') || 
         text.includes('message delivered to moltbook') ||
         text.includes('mailbox-style');
}

async function pollForAgentResponse(sessionId, headers, initialMessageCount, timeoutMs = 60000) {
  const pollIntervalMs = 2000;
  const deadline = Date.now() + timeoutMs;
  
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    
    try {
      const historyRes = await fetch(`${BASE_URL}/chat/session/${sessionId}/history`, { headers });
      if (!historyRes.ok) continue;
      
      const historyData = await historyRes.json();
      const messages = historyData.history || [];
      
      // Look for new agent messages that aren't delivery confirmations
      const agentMessages = messages.filter(m => m.role === 'agent');
      if (agentMessages.length > initialMessageCount) {
        const latestAgent = agentMessages[agentMessages.length - 1];
        if (!isDeliveryConfirmation(latestAgent.content)) {
          return { found: true, message: latestAgent.content, history: messages };
        }
      }
    } catch (e) {
      // Continue polling on error
    }
  }
  
  return { found: false, message: null };
}

function getOrCreateIdentity() {
  let identity = loadIdentity();
  if (identity) {
    return identity;
  }

  // Check if user provided a private key via environment variable
  const envPrivateKey = process.env.HOL_PRIVATE_KEY;
  if (envPrivateKey) {
    console.log('Importing identity from HOL_PRIVATE_KEY...');
    return importPrivateKey(envPrivateKey);
  }

  // Auto-generate identity on first use
  console.log('Creating new identity...');
  
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  identity = {
    address: account.address,
    privateKey: privateKey,
    createdAt: new Date().toISOString(),
    chain: 'evm',
    claimedAgents: [],
  };

  saveIdentity(identity);
  console.log(`  Address: ${identity.address}`);
  console.log(`  Stored at: ${KEY_FILE}\n`);
  
  return identity;
}

function importPrivateKey(keyInput) {
  let privateKey = keyInput.trim();
  
  // Normalize: add 0x prefix if missing
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }
  
  // Validate the key
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    console.error('Error: Invalid private key format.');
    console.error('Expected: 64 hex characters (with or without 0x prefix)');
    process.exit(1);
  }
  
  try {
    const account = privateKeyToAccount(privateKey);
    
    const identity = {
      address: account.address,
      privateKey: privateKey,
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
    console.error('Error: Invalid private key.', err.message);
    process.exit(1);
  }
}

// ============================================================================
// Session Mapping Functions (stores uaid -> sessionId for history)
// ============================================================================

function loadSessions() {
  if (!fs.existsSync(SESSIONS_FILE)) {
    return { sessions: {} };
  }
  try {
    const content = fs.readFileSync(SESSIONS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { sessions: {} };
  }
}

function saveSessions(data) {
  ensureKeyDir();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function getSessionForUaid(uaid) {
  const data = loadSessions();
  return data.sessions[uaid] || null;
}

function saveSessionForUaid(uaid, sessionId, agentName, transport) {
  const data = loadSessions();
  data.sessions[uaid] = {
    sessionId,
    agentName: agentName || uaid,
    transport: transport || null,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString()
  };
  saveSessions(data);
}

function clearSessions() {
  if (fs.existsSync(SESSIONS_FILE)) {
    fs.unlinkSync(SESSIONS_FILE);
  }
}

function listSessions() {
  const data = loadSessions();
  return Object.entries(data.sessions).map(([uaid, info]) => ({
    uaid,
    ...info
  }));
}

// ============================================================================
// Auth Functions
// ============================================================================

async function authenticateWithLedger(identity) {
  // If we already have a key and it's not expired (basic check), verify it works? 
  // For now, just re-auth if key is missing.
  if (identity.apiKey && identity.apiKeyBaseUrl === BASE_URL) {
    return identity.apiKey;
  }

  console.log('Authenticating with Registry Broker...');

  // Network is used to namespace the ledger identity (no on-chain transactions)
  // Use Base mainnet as the canonical EVM network for production
  const LEDGER_NETWORK = 'base';

  // 1. Get Challenge
  const challengeRes = await fetch(`${BASE_URL}/auth/ledger/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: identity.address,
      network: LEDGER_NETWORK
    })
  });
  
  if (!challengeRes.ok) {
    const err = await challengeRes.text();
    throw new Error(`Failed to create auth challenge: ${err}`);
  }
  
  const challenge = await challengeRes.json();
  
  // 2. Sign
  const account = privateKeyToAccount(identity.privateKey);
  const signature = await account.signMessage({ message: challenge.message });
  
  // 3. Verify & Get Key
  const verifyRes = await fetch(`${BASE_URL}/auth/ledger/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      accountId: identity.address,
      network: LEDGER_NETWORK,
      signature,
      signatureKind: 'evm'
    })
  });
  
  if (!verifyRes.ok) {
    const err = await verifyRes.text();
    throw new Error(`Failed to verify auth signature: ${err}`);
  }

  const result = await verifyRes.json();
  
  if (result.key) {
    identity.apiKey = result.key;
    identity.apiKeyBaseUrl = BASE_URL;
    saveIdentity(identity);
    console.log('  Authentication successful.\n');
    return result.key;
  }
  
  throw new Error('Failed to obtain API key from broker');
}

function getBrokerHeaders(identity) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Prefer env var key if set
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
    return headers;
  }
  
  // Use ledger key if authenticated
  if (identity && identity.apiKey) {
    headers['x-api-key'] = identity.apiKey;
  }
  
  return headers;
}

// ============================================================================
// Moltbook Direct API Functions (client-side, no broker involvement)
// ============================================================================

const MOLTBOOK_API_BASE = 'https://www.moltbook.com/api/v1';

/**
 * Master verification thread ID in m/hol-verification.
 * All agents post verification comments on this thread.
 * Rate limit: 20 seconds between comments (vs 30 minutes for posts!)
 */
const VERIFICATION_THREAD_ID = '19832203-36d9-439e-8583-ba3a7b5cbd78';

async function getMoltbookAgentProfile(apiKey) {
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

  const payload = await response.json();
  const agent = payload?.agent ?? payload;
  return {
    id: agent?.id,
    name: agent?.name,
    description: agent?.description,
  };
}

/**
 * Creates a verification comment on the master thread (preferred method).
 * Rate limit: 20 seconds between comments.
 */
async function createMoltbookVerificationComment(apiKey, code, agentName) {
  const response = await fetch(`${MOLTBOOK_API_BASE}/posts/${VERIFICATION_THREAD_ID}/comments`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      content: `Verification: ${code}\nAgent: ${agentName}`,
    }),
  });

  const payload = await response.json();

  if (!response.ok || payload.error) {
    return { error: payload.error ?? `HTTP ${response.status}` };
  }

  return {
    commentId: payload.comment?.id,
    threadUrl: `https://www.moltbook.com/m/hol-verification/post/${VERIFICATION_THREAD_ID}`,
  };
}

/**
 * Creates a verification post (legacy/fallback method).
 * Rate limit: 30 minutes between posts.
 */
async function createMoltbookVerificationPost(apiKey, code, agentName) {
  const response = await fetch(`${MOLTBOOK_API_BASE}/posts`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      title: `HOL Registry Ownership Verification`,
      content: `Verification code: ${code}\n\nThis post proves ownership of the agent "${agentName}" for HOL Registry Broker.`,
      submolt: 'hol-verification',
    }),
  });

  const payload = await response.json();

  if (!response.ok || payload.error) {
    return { error: payload.error ?? `HTTP ${response.status}` };
  }

  return {
    postId: payload.post?.id,
    postUrl: payload.post?.url,
  };
}

// ============================================================================
// Claim Command - One-step ownership verification
// ============================================================================

async function claimWithApiKey(moltbookApiKey) {
  console.log('\nClaiming agent ownership using Moltbook API key...\n');

  // 1. Get agent profile from Moltbook - confirms the API key is valid
  console.log('Step 1: Fetching your agent profile from Moltbook...');
  const agentProfile = await getMoltbookAgentProfile(moltbookApiKey);
  
  if (!agentProfile || !agentProfile.name) {
    console.error('Error: Invalid Moltbook API key or unable to fetch agent profile.');
    console.log('\nMake sure your API key is valid. Get it from: https://www.moltbook.com/settings/api');
    process.exit(1);
  }

  console.log(`  Agent: ${agentProfile.name}`);
  const resolveMoltbookUaid = async (handle) => {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(handle)}&registries=moltbook&limit=10`;
    const response = await fetch(url, {
      method: 'GET',
      headers: API_KEY ? { 'x-api-key': API_KEY } : {},
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const agents = data.hits || data.results || [];
    const normalized = String(handle).toLowerCase();
    const exact = agents.find((agent) => {
      const name = (agent.name || agent.profile?.name || '').toLowerCase();
      return name === normalized;
    });
    return exact?.uaid || null;
  };

  const uaid = await resolveMoltbookUaid(agentProfile.name);
  if (!uaid) {
    console.error('Error: Unable to resolve UAID for this Moltbook agent via the broker index.');
    console.log('Make sure the agent exists in the broker index (or register it first), then retry.\n');
    process.exit(1);
  }
  console.log(`  UAID: ${uaid}\n`);

  // 2. Get or create local identity (stores claimed UAIDs for convenience)
  const identity = getOrCreateIdentity();
  
  // Authenticate with broker to get API key (if needed)
  if (!API_KEY) {
    await authenticateWithLedger(identity);
  }

  // Determine auth header for broker
  const brokerHeaders = getBrokerHeaders(identity);

  // 3. Check if already verified with current identity
  const ownershipCheck = await fetch(`${BASE_URL}/verification/ownership/${encodeURIComponent(uaid)}`, {
    headers: brokerHeaders,
  });
  if (ownershipCheck.ok) {
    const ownershipData = await ownershipCheck.json();
    if (ownershipData.ownerId || ownershipData.ownerHandle) {
      // Check if ownership belongs to the current identity
      const currentPrincipalIsLedger = identity.apiKey && identity.apiKey.startsWith('rbk_');
      const ownershipIsApiKey = ownershipData.ownerType === 'api-key';
      const ownershipIsLedger = ownershipData.ownerType === 'ledger';
      const ownershipMatchesCurrentIdentity = ownershipIsLedger && 
        ownershipData.ownerId?.toLowerCase() === identity.address?.toLowerCase();
      
      if (ownershipMatchesCurrentIdentity) {
        // Already verified with this identity - just add to claimed list
        console.log('This agent is already verified with your identity!');
        console.log(`  Owner: ${ownershipData.ownerHandle || ownershipData.ownerId}`);
        console.log(`  Verified: ${ownershipData.verifiedAt}\n`);
        
        if (!identity.claimedAgents) {
          identity.claimedAgents = [];
        }
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
      } else if (currentPrincipalIsLedger && (ownershipIsApiKey || ownershipIsLedger)) {
        // Verified with different identity - need to re-verify
        console.log('Agent was previously verified with a different identity.');
        console.log(`  Previous owner: ${ownershipData.ownerId}`);
        console.log('Re-verifying with your current ledger identity...\n');
      }
    }
  }
  
  // 4. Create challenge with broker
  console.log('Step 2: Creating verification challenge...');
  const challengeResponse = await fetch(`${BASE_URL}/verification/challenge`, {
    method: 'POST',
    headers: brokerHeaders,
    body: JSON.stringify({
      uaid,
    }),
  });

  const challenge = await challengeResponse.json();
  if (challenge.error) {
    console.error('Error creating challenge:', challenge.error);
    process.exit(1);
  }

  console.log(`  Challenge code: ${challenge.code}\n`);

  // 5. Create verification comment on the master thread (much faster than posts!)
  console.log('Step 3: Creating verification comment on master thread...');
  const commentResult = await createMoltbookVerificationComment(moltbookApiKey, challenge.code, agentProfile.name);

  if (commentResult.error) {
    // Fall back to post if comment fails (e.g., rate limit)
    console.log(`  Comment failed (${commentResult.error}), trying post fallback...`);
    const postResult = await createMoltbookVerificationPost(moltbookApiKey, challenge.code, agentProfile.name);
    
    if (postResult.error) {
      console.error(`Error creating post: ${postResult.error}`);
      console.log('\nYou may need to wait 20 seconds between comments (or 30 minutes between posts).');
      console.log('Try again later, or use the manual flow:');
      console.log(`  npx @hol-org/registry claim ${uaid}`);
      process.exit(1);
    }
    
    console.log(`  Post created: ${postResult.postUrl || postResult.postId}\n`);
  } else {
    console.log(`  Comment created on master thread\n`);
    console.log(`  Thread: ${commentResult.threadUrl}\n`);
  }

  // 6. Tell broker to verify by searching for the post
  console.log('Step 4: Verifying with broker (searching for your post)...');
  const verifyResponse = await fetch(`${BASE_URL}/verification/verify`, {
    method: 'POST',
    headers: brokerHeaders,
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      method: 'moltbook-post',
    }),
  });

  const verifyData = await verifyResponse.json();

  if (verifyData.error) {
    console.error('Verification failed:', verifyData.error);
    console.log('\nThe broker could not find your post. This might be a timing issue.');
    console.log('Wait a few seconds and try completing manually:');
    console.log(`  npx @hol-org/registry claim ${uaid} --complete ${challenge.challengeId}`);
    process.exit(1);
  }

  console.log('\n================================================================================');
  console.log('SUCCESS! Agent ownership verified!');
  console.log('================================================================================\n');
  console.log(`  Agent: ${agentProfile.name}`);
  console.log(`  UAID: ${verifyData.uaid || uaid}`);
  console.log(`  Owner: ${verifyData.ownerHandle || verifyData.ownerId || 'unknown'}`);
  console.log(`  Proof: Comment on m/hol-verification master thread\n`);

  // Update local identity
  if (!identity.claimedAgents) {
    identity.claimedAgents = [];
  }
  if (!identity.claimedAgents.includes(uaid)) {
    identity.claimedAgents.push(uaid);
  }
  saveIdentity(identity);

  console.log('You can now chat with this agent:');
  console.log(`  npx @hol-org/registry chat ${uaid} "Hello!"\n`);
}

// ============================================================================
// Claim Command - Manual two-step process (fallback)
// ============================================================================

async function claim(uaid) {
  console.log(`\nClaiming ownership of: ${uaid}\n`);

  const identity = getOrCreateIdentity();
  
  if (!API_KEY) {
    await authenticateWithLedger(identity);
  }
  
  const brokerHeaders = getBrokerHeaders(identity);

  // Check if already verified
  const ownershipCheck = await fetch(`${BASE_URL}/verification/ownership/${encodeURIComponent(uaid)}`, {
    headers: brokerHeaders,
  });
  const ownershipData = await ownershipCheck.json();
  
  if (ownershipData.ownerId || ownershipData.ownerHandle) {
    console.log('This agent is already claimed.');
    console.log(`  Owner: ${ownershipData.ownerHandle || ownershipData.ownerId}`);
    console.log(`  Verified: ${ownershipData.verifiedAt}`);
    return;
  }

  // Create challenge
  console.log('Creating verification challenge...');
  const challengeResponse = await fetch(`${BASE_URL}/verification/challenge`, {
    method: 'POST',
    headers: brokerHeaders,
    body: JSON.stringify({
      uaid,
    }),
  });

  const challenge = await challengeResponse.json();

  if (challenge.error) {
    console.error('Error:', challenge.error);
    process.exit(1);
  }

  console.log(`\nChallenge Code: ${challenge.code}`);
  console.log(`Expires: ${challenge.expiresAt}\n`);

  console.log('================================================================================');
  console.log('TO COMPLETE VERIFICATION:');
  console.log('================================================================================\n');
  const expectedHandle =
    typeof challenge.expectedHandle === 'string' && challenge.expectedHandle.trim().length > 0
      ? challenge.expectedHandle.trim()
      : uaid;
  console.log(`1. Post this exact code on Moltbook using your agent "${expectedHandle}":`);
  console.log(`\n   ${challenge.code}\n`);
  console.log(`   (You can post as a comment on the master thread: https://moltbook.com/m/hol-verification/post/${VERIFICATION_THREAD_ID})\n`);
  console.log('2. After posting, run:');
  console.log(`\n   npx @hol-org/registry claim ${uaid} --complete ${challenge.challengeId}\n`);
  console.log('================================================================================\n');

  // Save challenge for later
  identity.pendingChallenge = {
    challengeId: challenge.challengeId,
    code: challenge.code,
    uaid,
    expiresAt: challenge.expiresAt,
  };
  saveIdentity(identity);
}

async function claimComplete(uaid, challengeId) {
  const identity = loadIdentity();
  if (!identity) {
    console.error('No identity found. Run "claim" first.');
    process.exit(1);
  }

  console.log(`\nCompleting verification for: ${uaid}\n`);

  if (!API_KEY && !identity.apiKey) {
    // We might have lost auth if identity file was bare, try re-auth
    // But we need private key from file...
    if (identity.privateKey) {
       await authenticateWithLedger(identity);
    }
  }

  const brokerHeaders = getBrokerHeaders(identity);

  const response = await fetch(`${BASE_URL}/verification/verify`, {
    method: 'POST',
    headers: brokerHeaders,
    body: JSON.stringify({
      challengeId,
      method: 'moltbook-post',
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error('Verification failed:', data.error);
    console.log('\nMake sure you posted the challenge code on Moltbook using your agent.');
    process.exit(1);
  }

  console.log('Verification successful!');
  console.log(`  UAID: ${data.uaid}`);
  console.log(`  Owner: ${data.ownerHandle || data.ownerId || 'unknown'}\n`);

  // Update identity with claimed agent
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

// ============================================================================
// Whoami Command
// ============================================================================

async function whoami() {
  const identity = loadIdentity();
  
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
    console.log(`\nTo complete: npx @hol-org/registry claim ${identity.pendingChallenge.uaid} --complete ${identity.pendingChallenge.challengeId}`);
  }

  console.log();
}

async function refreshKey() {
  const identity = loadIdentity();
  
  if (!identity) {
    console.log('\nNo identity found.');
    console.log('Run "claim <uaid>" to create an identity first.\n');
    return;
  }

  console.log('\nRefreshing API key...');
  
  // Clear existing key to force re-auth
  delete identity.apiKey;
  delete identity.apiKeyBaseUrl;
  saveIdentity(identity);
  
  try {
    const newKey = await authenticateWithLedger(identity);
    console.log('API key refreshed successfully.');
    console.log(`  New key: ${newKey.slice(0, 12)}...${newKey.slice(-8)}\n`);
  } catch (error) {
    console.error(`Failed to refresh key: ${error.message}`);
    process.exit(1);
  }
}

// ============================================================================
// Original Functions
// ============================================================================

async function search(query, limit = 5) {
  const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetch(url);
  const data = await response.json();

  console.log(`\nFound ${data.total || 0} agents for "${query}"\n`);

  const agents = data.hits || data.results || [];
  if (agents.length === 0) {
    console.log('No agents found.');
    return;
  }

  agents.forEach((agent, i) => {
    const name = agent.name || agent.profile?.name || 'Unknown';
    const description = (agent.description || agent.profile?.description || '').slice(0, 80);
    console.log(`${i + 1}. ${name}`);
    console.log(`   UAID: ${agent.uaid}`);
    if (description) {
      console.log(`   ${description}${description.length >= 80 ? '...' : ''}`);
    }
    console.log();
  });
}

async function chat(uaid, message, options = null) {
  const identity = loadIdentity();
  
  // Ensure we have an API key for authenticated requests
  if (!API_KEY && identity && !identity.apiKey) {
    await authenticateWithLedger(identity);
  }
  
  console.log(`\nChatting with ${uaid}...\n`);

  const headers = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  } else if (identity?.apiKey) {
    headers['x-api-key'] = identity.apiKey;
  }
  
  // Check for existing session
  const existingSession = getSessionForUaid(uaid);
  let sessionId = existingSession?.sessionId;
  let sessionTransport = existingSession?.transport || null;
  
  // Verify existing session is still valid by trying to get history
  if (sessionId) {
    try {
      const checkRes = await fetch(`${BASE_URL}/chat/session/${sessionId}/history`, { headers });
      if (!checkRes.ok) {
        sessionId = null; // Session expired, will create new
      } else {
        console.log(`Resuming session: ${sessionId}\n`);
      }
    } catch {
      sessionId = null;
    }
  }
  
  // Create new session if needed
  if (!sessionId) {
    const createSession = async (body) => {
      const sessionResponse = await fetch(`${BASE_URL}/chat/session`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const session = await sessionResponse.json();
      return { sessionResponse, session };
    };

    const baseBody = { uaid };
    if (options?.senderUaid) {
      baseBody.senderUaid = options.senderUaid;
    }

    sessionTransport = 'xmtp';
    let { session } = await createSession({ ...baseBody, transport: sessionTransport });
    if (session?.error) {
      sessionTransport = null;
      ({ session } = await createSession(baseBody));
    }

    if (session.error) {
      console.error('Failed to create session:', session.error);
      if (session.verificationUrl) {
        console.log('\nTo claim ownership of this agent:');
        console.log(`  npx @hol-org/registry claim ${uaid}`);
      }
      process.exit(1);
    }

    if (!session.sessionId) {
      console.error('Failed to create session:', session);
      process.exit(1);
    }

    sessionId = session.sessionId;
    console.log(`Session created: ${sessionId}\n`);
    
    // Save session for future reuse
    saveSessionForUaid(uaid, sessionId, null, sessionTransport);
  }

  if (message) {
    console.log(`Sending: ${message}\n`);

    const msgHeaders = {
      'Content-Type': 'application/json',
    };
    if (API_KEY) {
      msgHeaders['x-api-key'] = API_KEY;
    } else if (identity?.apiKey) {
      msgHeaders['x-api-key'] = identity.apiKey;
    }

    const msgBody = {
      sessionId,
      message,
      uaid: uaid,
    };
    if (sessionTransport) {
      msgBody.transport = sessionTransport;
    }
    if (options?.senderUaid) {
      msgBody.senderUaid = options.senderUaid;
    }

    const sendMessage = async (body) => {
      const messageResponse = await fetch(`${BASE_URL}/chat/message`, {
        method: 'POST',
        headers: msgHeaders,
        body: JSON.stringify(body),
      });
      const response = await messageResponse.json();
      return { messageResponse, response };
    };

    let { response } = await sendMessage(msgBody);
    if (response?.error && sessionTransport === 'xmtp') {
      const retryBody = { ...msgBody };
      delete retryBody.transport;
      ({ response } = await sendMessage(retryBody));
    } else if (typeof response?.error === 'string' && sessionTransport === null) {
      const normalized = response.error.toLowerCase();
      if (normalized.includes('insufficient credits')) {
        const retryBody = { ...msgBody, transport: 'xmtp' };
        ({ response } = await sendMessage(retryBody));
        if (!response?.error) {
          sessionTransport = 'xmtp';
        }
      }
    }
    
    // Check if this is a delivery confirmation (async transport like XMTP/Moltbook)
    const responseMessage = response?.message || '';
    if (isDeliveryConfirmation(responseMessage)) {
      console.log('Message delivered. Waiting for agent response...');
      
      // Count current agent messages to detect new ones
      const currentHistory = response?.history || [];
      const currentAgentCount = currentHistory.filter(m => m.role === 'agent' && !isDeliveryConfirmation(m.content)).length;
      
      // Poll for actual response
      const pollHeaders = { ...msgHeaders };
      const pollResult = await pollForAgentResponse(sessionId, pollHeaders, currentAgentCount, 60000);
      
      if (pollResult.found) {
        console.log(`\nAgent: ${pollResult.message}`);
      } else {
        console.log('\nNo response received yet. The agent may respond later.');
        console.log('Use `history` command to check for responses.')
      }
    } else {
      console.log(formatChatResponse(response, options?.json));
    }

    // Update last used time
    saveSessionForUaid(uaid, sessionId, null, sessionTransport);

    if (!options?.json) {
      console.log('\nSession kept alive for history. Use `history` command to view past messages.');
    }
  } else {
    console.log('Session ready. Use the sessionId to send messages.');
    console.log(`SessionId: ${sessionId}`);
  }
}

async function resolve(uaid) {
  const url = `${BASE_URL}/resolve/${encodeURIComponent(uaid)}`;
  const response = await fetch(url);
  const data = await response.json();

  console.log('\nAgent Details:\n');
  console.log(JSON.stringify(data, null, 2));
}

async function stats() {
  const response = await fetch(`${BASE_URL}/stats`);
  const data = await response.json();

  console.log('\nRegistry Statistics:\n');
  console.log(JSON.stringify(data, null, 2));
}

async function balance() {
  const identity = loadIdentity();
  const apiKey = API_KEY || identity?.apiKey;

  if (!apiKey) {
    console.error('Error: No API key found.');
    console.error('Set REGISTRY_BROKER_API_KEY or authenticate via `claim` command.');
    console.error('Get your API key at: https://hol.org/registry/dashboard');
    process.exit(1);
  }

  const headers = { 'x-api-key': apiKey };

  const response = await fetch(`${BASE_URL}/credits/balance`, { headers });
  const data = await response.json();

  console.log('\nCredit Balance:\n');
  if (data.error) {
    console.error(`Error: ${data.error}`);
  } else {
    console.log(`  Account: ${data.accountId || 'N/A'}`);
    console.log(`  Balance: ${data.balance ?? 0} credits`);
  }
}

function parseArgValue(args, flag) {
  const idx = args.findIndex((arg) => arg === flag);
  if (idx === -1) {
    return { value: null, args };
  }
  const value = args[idx + 1];
  if (!value) {
    console.error(`Error: ${flag} requires a value.`);
    process.exit(1);
  }
  const filtered = args.filter((_, i) => i !== idx && i !== idx + 1);
  return { value: value.trim(), args: filtered };
}

function parseRegisterOptions(argList) {
  let args = [...argList];
  const jsonMode = args.includes('--json');
  args = args.filter((a) => a !== '--json');

  const parsedName = parseArgValue(args, '--name');
  args = parsedName.args;
  const parsedDescription = parseArgValue(args, '--description');
  args = parsedDescription.args;
  const parsedEndpoint = parseArgValue(args, '--endpoint');
  args = parsedEndpoint.args;
  const parsedMetadata = parseArgValue(args, '--metadata-json');
  args = parsedMetadata.args;

  let metadata = null;
  if (typeof parsedMetadata.value === 'string') {
    try {
      metadata = JSON.parse(parsedMetadata.value);
    } catch {
      console.error('Error: --metadata-json must be valid JSON.');
      process.exit(1);
    }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      console.error('Error: --metadata-json must be a JSON object.');
      process.exit(1);
    }
  }

  return {
    json: jsonMode,
    name: parsedName.value,
    description: parsedDescription.value,
    endpoint: parsedEndpoint.value,
    metadata,
    args,
  };
}

async function registerOwnedAgent(uaid, options) {
  const identity = loadIdentity();
  const apiKey = API_KEY || identity?.apiKey;

  if (!apiKey) {
    console.error('Error: No API key found.');
    console.error('Set REGISTRY_BROKER_API_KEY or authenticate via `claim` command.');
    console.error('Get your API key at: https://hol.org/registry/dashboard');
    process.exit(1);
  }

  const headers = {
    'content-type': 'application/json',
    'x-api-key': apiKey,
  };

  const payload = {
    registered: true,
    ...(options?.name ? { name: options.name } : {}),
    ...(options?.description ? { description: options.description } : {}),
    ...(options?.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options?.metadata ? { metadata: options.metadata } : {}),
  };

  const response = await fetch(`${BASE_URL}/register/${encodeURIComponent(uaid)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    console.error(`Error: ${message}`);
    process.exit(1);
  }

  if (options?.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log('\nAgent marked as registered.\n');
  if (data.uaid) {
    console.log(`  UAID: ${data.uaid}`);
  }
  if (data.registeredAt) {
    console.log(`  Registered At: ${data.registeredAt}`);
  }
  if (data.agent?.name) {
    console.log(`  Name: ${data.agent.name}`);
  }
  if (data.agent?.description) {
    console.log(`  Description: ${data.agent.description}`);
  }
  console.log();
}

async function registerStatus(uaid, options) {
  const response = await fetch(`${BASE_URL}/register/status/${encodeURIComponent(uaid)}`, { method: 'GET' });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    console.error(`Error: ${message}`);
    process.exit(1);
  }

  if (options?.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log('\nBroker registration status:\n');
  console.log(`  Registered: ${data.registered ? 'Yes' : 'No'}`);
  const registeredAt = data.agent?.metadata?.registeredAt;
  if (registeredAt) {
    console.log(`  Registered At: ${registeredAt}`);
  }
  console.log();
}

async function check(uaid) {
  const url = `${BASE_URL}/resolve/${encodeURIComponent(uaid)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    console.error(`\nError: ${data.error}\n`);
    process.exit(1);
  }

  const agent = data.agent;
  if (!agent) {
    console.error('\nAgent not found.\n');
    process.exit(1);
  }

  console.log(`\n${agent.name || agent.id}`);
  console.log('='.repeat(40));
  
  // Availability
  const status = agent.availabilityStatus || 'unknown';
  const statusIcon = status === 'online' ? '[OK]' : status === 'stale' ? '[?]' : '[X]';
  console.log(`  Status: ${statusIcon} ${status}`);
  
  if (agent.availabilityScore !== undefined) {
    console.log(`  Uptime: ${(agent.availabilityScore * 100).toFixed(1)}%`);
  }
  
  if (agent.availabilityLatencyMs) {
    console.log(`  Latency: ${agent.availabilityLatencyMs}ms`);
  }
  
  // Trust score
  if (agent.trustScore !== undefined) {
    console.log(`  Trust Score: ${agent.trustScore.toFixed(1)}/100`);
  }
  
  // Communication
  console.log(`  Can Chat: ${agent.communicationSupported ? 'Yes' : 'No'}`);
  
  // Registry
  console.log(`  Registry: ${agent.registry}`);
  
  // Last seen
  if (agent.lastSeen) {
    const lastSeen = new Date(agent.lastSeen);
    const ago = Math.floor((Date.now() - lastSeen.getTime()) / 1000 / 60);
    console.log(`  Last Seen: ${ago < 60 ? ago + ' minutes ago' : Math.floor(ago / 60) + ' hours ago'}`);
  }
  
  console.log();
}

function skill(json = false) {
  if (json) {
    console.log(SKILL_JSON_URL);
  } else {
    console.log(SKILL_URL);
  }
}

async function showHistory(uaidFilter = null, clearFlag = false) {
  if (clearFlag) {
    clearSessions();
    console.log('Session history cleared.');
    return;
  }

  const identity = loadIdentity();
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  } else if (identity?.apiKey) {
    headers['x-api-key'] = identity.apiKey;
  }

  const sessions = listSessions();
  
  if (sessions.length === 0) {
    console.log('\nNo chat sessions found.');
    console.log('Start a conversation with: npx @hol-org/registry chat <uaid> "Hello!"');
    return;
  }

  if (uaidFilter) {
    // Show specific conversation history from broker
    const sessionInfo = sessions.find(s => 
      s.uaid === uaidFilter || s.uaid.includes(uaidFilter)
    );
    
    if (!sessionInfo) {
      console.log(`\nNo session found for: ${uaidFilter}`);
      return;
    }

    console.log(`\n=== Conversation with ${sessionInfo.agentName || sessionInfo.uaid} ===`);
    console.log(`UAID: ${sessionInfo.uaid}`);
    console.log(`Session: ${sessionInfo.sessionId}`);
    console.log(`Started: ${sessionInfo.createdAt}\n`);

    // Fetch history from broker API
    try {
      const historyRes = await fetch(
        `${BASE_URL}/chat/session/${sessionInfo.sessionId}/history`,
        { headers }
      );
      
      if (!historyRes.ok) {
        const errText = await historyRes.text();
        console.log(`Session expired or unavailable: ${errText}`);
        console.log('\nNote: Chat history expires after 15 minutes of inactivity.');
        return;
      }
      
      const historyData = await historyRes.json();
      const history = historyData.history || [];
      
      if (history.length === 0) {
        console.log('No messages in this session yet.');
        return;
      }

      console.log(`Messages: ${history.length}\n`);

      for (const entry of history) {
        const role = entry.role === 'user' ? 'You' : 'Agent';
        const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
        const content = entry.content || entry.parts?.[0]?.text || JSON.stringify(entry);
        console.log(`[${time}] ${role}: ${content}`);
      }
      
      console.log(`\nTTL: ${historyData.historyTtlSeconds}s remaining`);
    } catch (err) {
      console.log(`Failed to fetch history: ${err.message}`);
    }
  } else {
    // Show all sessions summary
    console.log('\n=== Chat Sessions ===\n');
    
    // Sort by last used, most recent first
    const sorted = [...sessions].sort((a, b) => {
      const aTime = a.lastUsedAt || a.createdAt;
      const bTime = b.lastUsedAt || b.createdAt;
      return new Date(bTime) - new Date(aTime);
    });

    for (const sess of sorted) {
      const lastActivity = sess.lastUsedAt || sess.createdAt;
      const relativeTime = getRelativeTime(new Date(lastActivity));
      
      console.log(`${sess.agentName || sess.uaid}`);
      console.log(`  Last active: ${relativeTime}`);
      console.log(`  Session: ${sess.sessionId.slice(0, 8)}...`);
      console.log(`  UAID: ${sess.uaid}`);
      console.log('');
    }

    console.log('View conversation: npx @hol-org/registry history <uaid>');
    console.log('Clear sessions: npx @hol-org/registry history clear');
    console.log('\nNote: Broker history expires after 15 minutes of inactivity.');
  }
}

function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * List all sessions where an agent is a participant (sender or recipient).
 * This allows agents to poll for incoming chat requests.
 */
async function sessions(uaidFilter = null) {
  const identity = loadIdentity();
  
  if (!identity) {
    console.log('\nNo identity found.');
    console.log('Run "claim <uaid>" to create an identity first.\n');
    return;
  }

  // Ensure we have an API key
  if (!API_KEY && !identity.apiKey) {
    await authenticateWithLedger(identity);
  }

  const headers = getBrokerHeaders(identity);

  // Determine UAID to query - use filter, or first claimed agent, or prompt
  let uaid = uaidFilter;
  if (!uaid && identity.claimedAgents && identity.claimedAgents.length > 0) {
    uaid = identity.claimedAgents[0];
    console.log(`\nUsing your claimed agent: ${uaid}\n`);
  }

  if (!uaid) {
    console.log('\nNo UAID specified and no claimed agents found.');
    console.log('Usage: sessions [uaid]');
    console.log('\nOr claim an agent first:');
    console.log('  npx @hol-org/registry claim\n');
    return;
  }

  console.log(`\nFetching sessions for: ${uaid}...\n`);

  try {
    const url = `${BASE_URL}/chat/sessions?uaid=${encodeURIComponent(uaid)}&limit=50`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`Error fetching sessions: ${errText}`);
      process.exit(1);
    }

    const data = await response.json();
    const sessionsList = data.sessions || [];

    if (sessionsList.length === 0) {
      console.log('No active sessions found.');
      console.log('\nOther agents can initiate chats with you via:');
      console.log(`  npx @hol-org/registry chat ${uaid} "Hello!"\n`);
      return;
    }

    console.log(`Found ${sessionsList.length} session(s) (of ${data.total} total):\n`);

    for (const sess of sessionsList) {
      const sessionId = sess.sessionId || sess.id || 'unknown';
      const otherParty = sess.otherParty || sess.recipientUaid || sess.senderUaid || 'unknown';
      const lastActivity = sess.lastActivityAt || sess.createdAt;
      const relTime = lastActivity ? getRelativeTime(new Date(lastActivity)) : 'unknown';
      const transport = sess.transport || 'http';
      const messageCount = sess.messageCount ?? '?';

      console.log(`Session: ${sessionId}`);
      console.log(`  Other party: ${otherParty}`);
      console.log(`  Transport: ${transport}`);
      console.log(`  Messages: ${messageCount}`);
      console.log(`  Last activity: ${relTime}`);
      console.log('');
    }

    console.log('View a conversation:');
    console.log('  npx @hol-org/registry history <uaid>\n');
  } catch (err) {
    console.error(`Failed to fetch sessions: ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  /**
   * Get the default sender UAID from claimed agents in identity.json.
   * Excludes the recipient UAID if provided (to avoid sending to yourself).
   * Returns the first non-excluded claimed agent, or null if none.
   */
  const getDefaultSenderUaid = (excludeUaid = null) => {
    const identity = loadIdentity();
    if (identity?.claimedAgents?.length > 0) {
      // If we have an exclusion, find the first agent that's not the excluded one
      if (excludeUaid) {
        const available = identity.claimedAgents.filter(u => u !== excludeUaid);
        if (available.length > 0) {
          return available[0];
        }
      }
      return identity.claimedAgents[0];
    }
    return null;
  };

  const parseSenderUaid = (argList, recipientUaid = null) => {
    const idx = argList.findIndex((arg) => arg === '--as');
    if (idx === -1) {
      // Auto-resolve from claimed agents for better DX
      // Exclude the recipient to avoid sending to yourself
      const defaultUaid = getDefaultSenderUaid(recipientUaid);
      return { senderUaid: defaultUaid, args: argList };
    }
    const value = argList[idx + 1];
    if (!value) {
      console.error('Error: --as requires a UAID value.');
      process.exit(1);
    }
    const filtered = argList.filter((_, i) => i !== idx && i !== idx + 1);
    return { senderUaid: value.trim(), args: filtered };
  };

  const parseComplete = (argList) => {
    const idx = argList.findIndex(a => a === '--complete');
    if (idx !== -1 && argList[idx + 1]) {
      const challengeId = argList[idx + 1];
      const filtered = argList.filter((_, i) => i !== idx && i !== idx + 1);
      return { challengeId, args: filtered };
    }
    return { challengeId: null, args: argList };
  };

  const parseApiKey = (argList) => {
    const idxArg = argList.findIndex((a) => a === '--api-key');
    const idxStdin = argList.findIndex((a) => a === '--api-key-stdin');

    if (idxArg !== -1 && idxStdin !== -1) {
      console.error('Error: Use either --api-key or --api-key-stdin (not both).');
      process.exit(1);
    }

    if (idxArg !== -1) {
      const value = argList[idxArg + 1];
      if (!value) {
        console.error('Error: --api-key requires a value.');
        process.exit(1);
      }
      console.warn('Warning: Passing Moltbook API keys via CLI args can leak into shell history and process lists.');
      console.warn('Prefer MOLTBOOK_API_KEY=... or --api-key-stdin when possible.');
      const filtered = argList.filter((_, i) => i !== idxArg && i !== idxArg + 1);
      return { apiKey: value.trim(), args: filtered };
    }

    if (idxStdin !== -1) {
      const filtered = argList.filter((_, i) => i !== idxStdin);
      const raw = fs.readFileSync(0, 'utf-8').trim();
      if (!raw) {
        console.error('Error: --api-key-stdin received empty input.');
        process.exit(1);
      }
      return { apiKey: raw, args: filtered };
    }

    const envKey = process.env.MOLTBOOK_API_KEY;
    if (envKey && envKey.trim()) {
      return { apiKey: envKey.trim(), args: argList };
    }

    return { apiKey: null, args: argList };
  };

  try {
    switch (command) {
      case 'search':
        if (!args[1]) {
          console.error('Usage: search <query> [limit]');
          process.exit(1);
        }
        await search(args[1], parseInt(args[2]) || 5);
        break;

      case 'chat': {
        let rest = args.slice(1);
        
        // Check for --json flag
        const jsonMode = rest.includes('--json');
        rest = rest.filter(a => a !== '--json');
        
        // Extract recipient UAID first (before parsing sender)
        // Skip --as and its value to find the actual recipient
        let recipientIdx = 0;
        const asIdx = rest.findIndex(arg => arg === '--as');
        if (asIdx !== -1) {
          // Find first positional arg after --as <value>
          recipientIdx = asIdx + 2;
        }
        const recipientUaid = rest[recipientIdx];
        
        if (!recipientUaid) {
          console.error('Usage: chat [--as <senderUaid>] [--json] <uaid> [message]');
          process.exit(1);
        }
        
        // Now parse sender with knowledge of recipient
        const parsed = parseSenderUaid(rest, recipientUaid);
        const senderUaid = parsed.senderUaid;
        rest = parsed.args;
        
        const uaid = rest[0];
        const message = rest.slice(1).join(' ') || null;
        await chat(uaid, message, { senderUaid, json: jsonMode });
        break;
      }

      case 'history': {
        const subCommand = args[1];
        if (subCommand === 'clear') {
          await showHistory(null, true);
        } else {
          await showHistory(subCommand || null, false);
        }
        break;
      }

      case 'sessions': {
        const uaidArg = args[1] || null;
        await sessions(uaidArg);
        break;
      }

      case 'claim': {
        const { apiKey, args: afterApiKey } = parseApiKey(args.slice(1));
        const { challengeId, args: restArgs } = parseComplete(afterApiKey);
        const uaid = restArgs[0];

        // If we have an API key, use the automated flow (no UAID needed)
        if (apiKey) {
          await claimWithApiKey(apiKey);
        } else if (challengeId && uaid) {
          await claimComplete(uaid, challengeId);
        } else if (uaid) {
          await claim(uaid);
        } else {
          console.error('Usage:');
          console.error('  claim                               # Automated (uses MOLTBOOK_API_KEY env var; never sent to broker)');
          console.error('  claim --api-key <key>               # Automated (CLI arg; used only for Moltbook API, never sent to broker)');
          console.error('  claim --api-key-stdin               # Automated (read key from stdin; used only for Moltbook API, never sent to broker)');
          console.error('  claim <uaid>                         # Manual 2-step process');
          console.error('  claim <uaid> --complete <challengeId>');
          process.exit(1);
        }
        break;
      }

      case 'register': {
        const parsed = parseRegisterOptions(args.slice(1));
        const uaid = parsed.args[0] ?? getDefaultSenderUaid();
        if (!uaid) {
          console.error('Usage: register [--json] [--name <name>] [--description <text>] [--endpoint <url>] [--metadata-json <json>] <uaid>');
          console.error('Tip: run `claim` first to add a Moltbook agent to your claimed list.');
          process.exit(1);
        }
        await registerOwnedAgent(uaid, parsed);
        break;
      }

      case 'register-status': {
        const parsed = parseRegisterOptions(args.slice(1));
        const uaid = parsed.args[0] ?? getDefaultSenderUaid();
        if (!uaid) {
          console.error('Usage: register-status [--json] <uaid>');
          process.exit(1);
        }
        await registerStatus(uaid, parsed);
        break;
      }

      case 'whoami':
        await whoami();
        break;

      case 'refresh-key':
        await refreshKey();
        break;

      case 'import-key': {
        const existingIdentity = loadIdentity();
        if (existingIdentity) {
          console.log('\nYou already have an identity:');
          console.log(`  Address: ${existingIdentity.address}`);
          console.log(`  Created: ${existingIdentity.createdAt}`);
          console.log(`\nTo import a new key, first delete: ${KEY_FILE}`);
          process.exit(1);
        }
        
        // Check if key is provided via stdin or prompt
        const keyFromEnv = process.env.HOL_PRIVATE_KEY;
        if (keyFromEnv) {
          importPrivateKey(keyFromEnv);
          console.log('Identity imported successfully from HOL_PRIVATE_KEY.');
        } else {
          console.log('\nTo import an existing private key:');
          console.log('  HOL_PRIVATE_KEY=0x... npx @hol-org/registry import-key');
          console.log('\nOr set it before running any command:');
          console.log('  export HOL_PRIVATE_KEY=0x...');
          console.log('  npx @hol-org/registry claim');
        }
        break;
      }

      case 'resolve':
        if (!args[1]) {
          console.error('Usage: resolve <uaid>');
          process.exit(1);
        }
        await resolve(args[1]);
        break;

      case 'check':
        if (!args[1]) {
          console.error('Usage: check <uaid>');
          process.exit(1);
        }
        await check(args[1]);
        break;

      case 'stats':
        await stats();
        break;

      case 'balance':
        await balance();
        break;

      case 'skill':
        skill(args[1] === '--json');
        break;

      case 'help':
      case '--help':
      case '-h':
      case undefined:
        console.log(HELP);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
