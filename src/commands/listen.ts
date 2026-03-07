import { REGISTRY_BROKER_API_KEY } from '../config';
import { ensureBrokerApiKey } from '../auth';
import { getOrCreateIdentity } from '../identity';
import { createRbClient, requestJsonSafe } from '../rb';
import { getSessionForUaid, listSessions } from '../sessions';
import { getString, isRecord } from '../utils/guards';

type SessionTarget = {
  sessionId: string;
  uaid: string | null;
  transport: string | null;
};

type HistoryEntry = {
  role: string;
  content: string;
  messageId: string;
  timestamp: string | null;
};

type ListenerState = SessionTarget & {
  seenAgentMessageKeys: Set<string>;
  repliesSent: number;
};

export type ListenRespondOptions = {
  senderUaid?: string | null;
  replyTemplate?: string | null;
  pollMs?: number;
  timeoutMs?: number;
  concurrency?: number;
  includeExisting?: boolean;
  maxRepliesPerSession?: number;
  json?: boolean;
};

const DELIVERY_CONFIRMATION_MATCHERS = [
  'message sent via xmtp',
  'message delivered to moltbook',
  'mailbox-style',
];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDeliveryConfirmation(message: string) {
  if (!message) {
    return false;
  }
  const normalized = message.toLowerCase();
  return DELIVERY_CONFIRMATION_MATCHERS.some((matcher) =>
    normalized.includes(matcher),
  );
}

function normalizeHistoryEntry(entry: unknown, index: number): HistoryEntry | null {
  if (!isRecord(entry)) {
    return null;
  }

  const role = getString(entry.role);
  const content = getString(entry.content);
  if (!role || !content) {
    return null;
  }

  const timestamp = getString(entry.timestamp);
  const messageId =
    getString(entry.messageId) ??
    `${role}:${timestamp ?? 'na'}:${index}:${content.slice(0, 64)}`;

  return {
    role,
    content,
    messageId,
    timestamp,
  };
}

function extractHistory(data: unknown): HistoryEntry[] {
  if (!isRecord(data)) {
    return [];
  }
  const historyRaw = Array.isArray(data.history) ? data.history : [];
  const history: HistoryEntry[] = [];

  for (let index = 0; index < historyRaw.length; index += 1) {
    const normalized = normalizeHistoryEntry(historyRaw[index], index);
    if (normalized) {
      history.push(normalized);
    }
  }

  return history;
}

function buildMessageKey(entry: HistoryEntry): string {
  return `${entry.messageId}:${entry.timestamp ?? 'na'}`;
}

function buildReply(
  template: string,
  entry: HistoryEntry,
  target: SessionTarget,
): string {
  const replacements: Record<string, string> = {
    message: entry.content,
    sessionId: target.sessionId,
    uaid: target.uaid ?? '',
  };
  return template.replaceAll(
    /{(message|sessionId|uaid)}/g,
    (_placeholder, key: string) => replacements[key] ?? '',
  );
}

function printEvent(
  jsonMode: boolean,
  event: Record<string, unknown>,
  message: string,
) {
  if (jsonMode) {
    console.log(JSON.stringify(event));
    return;
  }
  console.log(message);
}

async function withConcurrency<T>(
  entries: T[],
  limit: number,
  worker: (entry: T) => Promise<void>,
) {
  const maxWorkers = Math.max(1, Math.floor(limit));
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < entries.length) {
      const current = entries[cursor];
      cursor += 1;
      await worker(current);
    }
  };

  const workers: Promise<void>[] = [];
  for (let index = 0; index < maxWorkers; index += 1) {
    workers.push(runWorker());
  }
  await Promise.all(workers);
}

function normalizeSessionTarget(
  value: unknown,
  fallbackUaid: string | null = null,
): SessionTarget | null {
  if (!isRecord(value)) {
    return null;
  }
  const sessionId = getString(value.sessionId);
  if (!sessionId || !sessionId.trim()) {
    return null;
  }
  const uaid = getString(value.uaid) ?? fallbackUaid;
  const transport = getString(value.transport) ?? null;
  return {
    sessionId: sessionId.trim(),
    uaid: uaid && uaid.trim() ? uaid.trim() : null,
    transport: transport && transport.trim() ? transport.trim() : null,
  };
}

function dedupeTargets(targets: SessionTarget[]): SessionTarget[] {
  const deduped = new Map<string, SessionTarget>();
  for (const target of targets) {
    const existing = deduped.get(target.sessionId);
    if (!existing) {
      deduped.set(target.sessionId, target);
      continue;
    }
    if (!existing.uaid && target.uaid) {
      deduped.set(target.sessionId, target);
    }
  }
  return Array.from(deduped.values());
}

function resolveTargets(
  uaids: string[],
  sessionIds: string[],
): SessionTarget[] {
  const knownSessions = listSessions()
    .map((entry) => normalizeSessionTarget(entry))
    .filter((entry): entry is SessionTarget => entry !== null);

  const targets: SessionTarget[] = [];

  if (uaids.length > 0) {
    for (const uaid of uaids) {
      const fromKnown = knownSessions.find((session) => session.uaid === uaid);
      if (fromKnown) {
        targets.push(fromKnown);
        continue;
      }
      const direct = getSessionForUaid(uaid);
      const fromDirect = normalizeSessionTarget(direct, uaid);
      if (fromDirect) {
        targets.push(fromDirect);
      }
    }
  }

  if (sessionIds.length > 0) {
    for (const sessionId of sessionIds) {
      const fromKnown = knownSessions.find(
        (session) => session.sessionId === sessionId,
      );
      if (fromKnown) {
        targets.push(fromKnown);
        continue;
      }
      targets.push({
        sessionId,
        uaid: null,
        transport: null,
      });
    }
  }

  if (uaids.length === 0 && sessionIds.length === 0) {
    targets.push(...knownSessions);
  }

  return dedupeTargets(targets);
}

export async function listenAndRespond(
  uaids: string[],
  sessionIds: string[],
  options: ListenRespondOptions | null = null,
) {
  const jsonMode = Boolean(options?.json);
  const pollMs = Math.max(250, Math.floor(options?.pollMs ?? 2000));
  const timeoutMs = Math.max(0, Math.floor(options?.timeoutMs ?? 120000));
  const concurrency = Math.max(1, Math.floor(options?.concurrency ?? 3));
  const includeExisting = Boolean(options?.includeExisting);
  const maxRepliesPerSession = Math.max(
    1,
    Math.floor(options?.maxRepliesPerSession ?? 20),
  );

  const replyTemplate =
    typeof options?.replyTemplate === 'string' &&
    options.replyTemplate.trim().length > 0
      ? options.replyTemplate
      : 'Acknowledged for {uaid}: "{message}". Continue with the next step in one sentence.';

  const normalizedUaids = uaids.map((uaid) => uaid.trim()).filter(Boolean);
  const normalizedSessionIds = sessionIds
    .map((sessionId) => sessionId.trim())
    .filter(Boolean);

  const targets = resolveTargets(normalizedUaids, normalizedSessionIds);
  if (targets.length === 0) {
    printEvent(
      jsonMode,
      {
        event: 'listener-empty',
        uaids: normalizedUaids,
        sessions: normalizedSessionIds,
      },
      'No sessions found to monitor. Start one with `chat <uaid> "Hello"` first.',
    );
    return;
  }

  const identity = getOrCreateIdentity();
  const apiKey =
    REGISTRY_BROKER_API_KEY || (await ensureBrokerApiKey(identity));
  const client = createRbClient({ apiKey });

  printEvent(
    jsonMode,
    {
      event: 'listener-started',
      targets: targets.length,
      pollMs,
      timeoutMs,
      concurrency,
      maxRepliesPerSession,
      includeExisting,
    },
    `Listening on ${targets.length} session(s) with concurrency=${concurrency}, poll=${pollMs}ms.`,
  );

  const states: ListenerState[] = targets.map((target) => ({
    ...target,
    seenAgentMessageKeys: new Set<string>(),
    repliesSent: 0,
  }));

  await withConcurrency(states, concurrency, async (state) => {
    const historyRes = await requestJsonSafe(
      client,
      `/chat/session/${encodeURIComponent(state.sessionId)}/history`,
      { method: 'GET' },
    );
    if (!historyRes.ok) {
      printEvent(
        jsonMode,
        {
          event: 'session-unavailable',
          sessionId: state.sessionId,
          uaid: state.uaid,
          status: historyRes.status,
        },
        `Session unavailable: ${state.sessionId} (${historyRes.error || historyRes.status})`,
      );
      return;
    }

    const entries = extractHistory(historyRes.data);
    if (!includeExisting) {
      for (const entry of entries) {
        if (entry.role === 'agent' && !isDeliveryConfirmation(entry.content)) {
          state.seenAgentMessageKeys.add(buildMessageKey(entry));
        }
      }
    }
  });

  const startedAt = Date.now();

  while (timeoutMs === 0 || Date.now() - startedAt < timeoutMs) {
    await withConcurrency(states, concurrency, async (state) => {
      if (state.repliesSent >= maxRepliesPerSession) {
        return;
      }

      const historyRes = await requestJsonSafe(
        client,
        `/chat/session/${encodeURIComponent(state.sessionId)}/history`,
        { method: 'GET' },
      );
      if (!historyRes.ok) {
        printEvent(
          jsonMode,
          {
            event: 'history-fetch-failed',
            sessionId: state.sessionId,
            uaid: state.uaid,
            status: historyRes.status,
          },
          `Failed to fetch history for ${state.sessionId}: ${historyRes.error || historyRes.status}`,
        );
        return;
      }

      const entries = extractHistory(historyRes.data);
      const unseenAgentMessages = entries.filter((entry) => {
        if (entry.role !== 'agent') {
          return false;
        }
        if (isDeliveryConfirmation(entry.content)) {
          return false;
        }
        return !state.seenAgentMessageKeys.has(buildMessageKey(entry));
      });

      for (const entry of unseenAgentMessages) {
        if (state.repliesSent >= maxRepliesPerSession) {
          break;
        }

        state.seenAgentMessageKeys.add(buildMessageKey(entry));
        const reply = buildReply(replyTemplate, entry, state);
        const body: Record<string, unknown> = {
          sessionId: state.sessionId,
          message: reply,
        };
        if (state.uaid) {
          body.uaid = state.uaid;
        }
        if (state.transport) {
          body.transport = state.transport;
        }
        if (options?.senderUaid) {
          body.senderUaid = options.senderUaid;
        }

        const sendRes = await requestJsonSafe(client, '/chat/message', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });

        if (!sendRes.ok) {
          printEvent(
            jsonMode,
            {
              event: 'reply-failed',
              sessionId: state.sessionId,
              uaid: state.uaid,
              status: sendRes.status,
              sourceMessage: entry.content,
            },
            `Reply failed for ${state.sessionId}: ${sendRes.error || sendRes.status}`,
          );
          continue;
        }

        state.repliesSent += 1;
        printEvent(
          jsonMode,
          {
            event: 'reply-sent',
            sessionId: state.sessionId,
            uaid: state.uaid,
            sourceMessage: entry.content,
            reply,
            repliesSent: state.repliesSent,
          },
          `Replied on ${state.sessionId} [${state.repliesSent}/${maxRepliesPerSession}]`,
        );
      }
    });

    await wait(pollMs);
  }

  printEvent(
    jsonMode,
    {
      event: 'listener-stopped',
      elapsedMs: Date.now() - startedAt,
      sessions: states.map((state) => ({
        sessionId: state.sessionId,
        uaid: state.uaid,
        repliesSent: state.repliesSent,
      })),
    },
    'Listener timeout reached; monitoring stopped.',
  );
}
