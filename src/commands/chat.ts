import { REGISTRY_BROKER_API_KEY } from '../config';
import { ensureBrokerApiKey } from '../auth';
import { getOrCreateIdentity } from '../identity';
import { createRbClient, requestJsonSafe } from '../rb';
import { getSessionForUaid, saveSessionForUaid } from '../sessions';
import { getString, isRecord } from '../utils/guards';

function formatChatResponse(response: any, jsonMode = false) {
  if (jsonMode) {
    return JSON.stringify(response, null, 2);
  }

  if (response.error) {
    return `Error: ${response.error}`;
  }

  const lines: string[] = [];

  if (response.message) {
    lines.push(`Agent: ${response.message}`);
  }

  if (response.metadata?.provider) {
    lines.push(`  Transport: ${response.metadata.provider}`);
  }

  if (response.metadata?.conversationId) {
    lines.push(
      `  Conversation: ${String(response.metadata.conversationId).slice(
        0,
        12,
      )}...`,
    );
  }

  if (response.historyTtlSeconds) {
    const mins = Math.floor(Number(response.historyTtlSeconds) / 60);
    lines.push(`  History expires in: ${mins} minutes`);
  }

  return lines.join('\n');
}

function isDeliveryConfirmation(message: string) {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes('message sent via xmtp') ||
    text.includes('message delivered to moltbook') ||
    text.includes('mailbox-style')
  );
}

async function pollForAgentResponse(
  sessionId: string,
  client: any,
  initialMessageCount: number,
  timeoutMs = 60000,
) {
  const pollIntervalMs = 2000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    try {
      const historyRes = await requestJsonSafe(
        client,
        `/chat/session/${encodeURIComponent(sessionId)}/history`,
        { method: 'GET' },
      );
      if (!historyRes.ok) continue;

      const historyData = isRecord(historyRes.data) ? historyRes.data : {};
      const messages = Array.isArray(historyData.history) ? historyData.history : [];

      const agentMessages = messages.filter((m: any) => m.role === 'agent');
      if (agentMessages.length > initialMessageCount) {
        const latestAgent = agentMessages[agentMessages.length - 1];
        if (!isDeliveryConfirmation(latestAgent.content)) {
          return {
            found: true,
            message: latestAgent.content,
            history: messages,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return { found: false, message: null };
}

export async function chat(
  uaid: string,
  message: string | null,
  options: {
    json?: boolean;
    transport?: string | null;
    agentUrl?: string | null;
    senderUaid?: string | null;
  } | null = null,
) {
  const identity = getOrCreateIdentity();
  const apiKey =
    REGISTRY_BROKER_API_KEY || (await ensureBrokerApiKey(identity));
  const client = createRbClient({ apiKey });

  const targetLabel =
    options?.agentUrl && uaid && uaid !== 'agent-url'
      ? uaid
      : options?.agentUrl
        ? options.agentUrl
        : uaid;
  console.log(`\nChatting with ${targetLabel}...\n`);

  const targetKey =
    options?.agentUrl && uaid && uaid !== 'agent-url'
      ? uaid
      : options?.agentUrl
        ? options.agentUrl
        : uaid;

  const existingSession = getSessionForUaid(targetKey);
  let sessionId: string | null = existingSession?.sessionId ?? null;
  let sessionTransport = existingSession?.transport || null;

  const normalizeTransport = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'xmtp') return 'xmtp';
    if (normalized === 'moltbook') return 'moltbook';
    if (normalized === 'http') return 'http';
    if (normalized === 'a2a') return 'a2a';
    if (normalized === 'acp') return 'acp';
    return null;
  };
  const requestedTransport = normalizeTransport(options?.transport);
  if (requestedTransport && requestedTransport !== sessionTransport) {
    sessionTransport = requestedTransport;
  }

  if (sessionId) {
    try {
      const checkRes = await requestJsonSafe(
        client,
        `/chat/session/${encodeURIComponent(sessionId)}/history`,
        { method: 'GET' },
      );
      if (!checkRes.ok) {
        sessionId = null;
      } else {
        console.log(`Resuming session: ${sessionId}\n`);
      }
    } catch {
      sessionId = null;
    }
  }

  if (!sessionId) {
    const createSession = async (body: Record<string, unknown>) => {
      const sessionResponse = await requestJsonSafe(client, '/chat/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      const session = isRecord(sessionResponse.data) ? sessionResponse.data : {};
      return { sessionResponse, session };
    };

    const baseBody: Record<string, unknown> = {};
    if (options?.agentUrl) baseBody.agentUrl = options.agentUrl;
    if (uaid && uaid !== 'agent-url') baseBody.uaid = uaid;
    if (options?.senderUaid) baseBody.senderUaid = options.senderUaid;

    if (requestedTransport) {
      sessionTransport = requestedTransport;
      let { session } = await createSession({
        ...baseBody,
        transport: sessionTransport,
      });
      if (getString(session.error)) {
        sessionTransport = null;
        ({ session } = await createSession(baseBody));
      }

      const error = getString(session.error);
      if (error) {
        console.error('Failed to create session:', error);
        const verificationUrl = getString(session.verificationUrl);
        if (verificationUrl) {
          console.log('\nTo claim ownership of this agent:');
          if (options?.agentUrl) {
            if (uaid && uaid !== 'agent-url') {
              console.log(`  npx @hol-org/registry claim ${uaid}`);
            } else {
              console.log(
                '  (Claim requires a UAID; provide a UAID to use claim.)',
              );
            }
          } else {
            console.log(`  npx @hol-org/registry claim ${uaid}`);
          }
        }
        process.exit(1);
      }

      const createdSessionId = getString(session.sessionId);
      if (!createdSessionId) {
        console.error('Failed to create session:', session);
        process.exit(1);
      }

      sessionId = createdSessionId;
      console.log(`Session created: ${sessionId}\n`);
    } else {
      sessionTransport = 'xmtp';
      let { session } = await createSession({
        ...baseBody,
        transport: sessionTransport,
      });
      if (getString(session.error)) {
        sessionTransport = null;
        ({ session } = await createSession(baseBody));
      }

      const error = getString(session.error);
      if (error) {
        console.error('Failed to create session:', error);
        const verificationUrl = getString(session.verificationUrl);
        if (verificationUrl) {
          console.log('\nTo claim ownership of this agent:');
          if (options?.agentUrl) {
            if (uaid && uaid !== 'agent-url') {
              console.log(`  npx @hol-org/registry claim ${uaid}`);
            } else {
              console.log(
                '  (Claim requires a UAID; provide a UAID to use claim.)',
              );
            }
          } else {
            console.log(`  npx @hol-org/registry claim ${uaid}`);
          }
        }
        process.exit(1);
      }

      const createdSessionId = getString(session.sessionId);
      if (!createdSessionId) {
        console.error('Failed to create session:', session);
        process.exit(1);
      }

      sessionId = createdSessionId;
      console.log(`Session created: ${sessionId}\n`);
    }

    saveSessionForUaid(targetKey, sessionId, null, sessionTransport);
  }

  if (message) {
    console.log(`Sending: ${message}\n`);

    const msgBody: Record<string, unknown> = { sessionId, message };
    if (options?.agentUrl) {
      msgBody.agentUrl = options.agentUrl;
      if (uaid && uaid !== 'agent-url') msgBody.uaid = uaid;
    } else {
      msgBody.uaid = uaid;
    }
    if (sessionTransport) msgBody.transport = sessionTransport;
    if (options?.senderUaid) msgBody.senderUaid = options.senderUaid;

    const sendMessage = async (body: Record<string, unknown>) => {
      const messageResponse = await requestJsonSafe(client, '/chat/message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      const response = isRecord(messageResponse.data) ? messageResponse.data : {};
      return { messageResponse, response };
    };

    let { response } = await sendMessage(msgBody);
    if (getString(response.error) && sessionTransport === 'xmtp') {
      const retryBody = { ...msgBody };
      delete (retryBody as any).transport;
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

    const responseMessage = getString(response.message) ?? '';
    if (isDeliveryConfirmation(responseMessage)) {
      console.log('Message delivered. Waiting for agent response...');

      const currentHistory = Array.isArray(response.history) ? response.history : [];
      const currentAgentCount = currentHistory.filter(
        (m: any) => m.role === 'agent' && !isDeliveryConfirmation(m.content),
      ).length;

      const pollResult = await pollForAgentResponse(
        sessionId,
        client,
        currentAgentCount,
        60000,
      );

      if (pollResult.found) {
        console.log(`\nAgent: ${pollResult.message}`);
      } else {
        console.log('\nNo response received yet. The agent may respond later.');
        console.log('Use `history` command to check for responses.');
      }
    } else {
      console.log(formatChatResponse(response, Boolean(options?.json)));
    }

    saveSessionForUaid(targetKey, sessionId, null, sessionTransport);

    if (!options?.json) {
      console.log(
        '\nSession kept alive for history. Use `history` command to view past messages.',
      );
    }
  } else {
    console.log('Session ready. Use the sessionId to send messages.');
    console.log(`SessionId: ${sessionId}`);
  }
}
