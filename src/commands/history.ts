import { REGISTRY_BROKER_API_KEY } from '../config';
import { createRbClient, requestJsonSafe } from '../rb';
import { loadIdentity } from '../identity';
import { clearSessions, listSessions } from '../sessions';
import { getRelativeTime } from '../utils/time';

export async function showHistory(
  uaidFilter: string | null = null,
  clearFlag = false,
) {
  if (clearFlag) {
    clearSessions();
    console.log('Session history cleared.');
    return;
  }

  const identity = loadIdentity();
  const apiKey = REGISTRY_BROKER_API_KEY || identity?.apiKey || null;
  const client = createRbClient(apiKey ? { apiKey } : {});

  const sessions = listSessions();

  if (sessions.length === 0) {
    console.log('\nNo chat sessions found.');
    console.log(
      'Start a conversation with: npx @hol-org/registry chat <uaid> "Hello!"',
    );
    return;
  }

  if (uaidFilter) {
    const sessionInfo = sessions.find(
      (s: any) => s.uaid === uaidFilter || String(s.uaid).includes(uaidFilter),
    );

    if (!sessionInfo) {
      console.log(`\nNo session found for: ${uaidFilter}`);
      return;
    }

    console.log(
      `\n=== Conversation with ${sessionInfo.agentName || sessionInfo.uaid} ===`,
    );
    console.log(`UAID: ${sessionInfo.uaid}`);
    console.log(`Session: ${sessionInfo.sessionId}`);
    console.log(`Started: ${sessionInfo.createdAt}\n`);

    try {
      const historyRes = await requestJsonSafe(
        client,
        `/chat/session/${encodeURIComponent(sessionInfo.sessionId)}/history`,
        { method: 'GET' },
      );

      if (!historyRes.ok) {
        const message =
          historyRes?.data &&
          typeof historyRes.data === 'object' &&
          'error' in historyRes.data &&
          (historyRes.data as any).error
            ? String((historyRes.data as any).error)
            : historyRes.error || `HTTP ${historyRes.status}`;
        console.log(`Session expired or unavailable: ${message}`);
        console.log('\nNote: Chat history expires after 15 minutes of inactivity.');
        return;
      }

      const historyData: any = historyRes.data || {};
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
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Failed to fetch history: ${message}`);
    }
  } else {
    console.log('\n=== Chat Sessions ===\n');

    const sorted = [...sessions].sort((a: any, b: any) => {
      const aTime = a.lastUsedAt || a.createdAt;
      const bTime = b.lastUsedAt || b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    for (const sess of sorted) {
      const lastActivity = sess.lastUsedAt || sess.createdAt;
      const relativeTime = getRelativeTime(new Date(lastActivity));

      console.log(`${sess.agentName || sess.uaid}`);
      console.log(`  Last active: ${relativeTime}`);
      console.log(`  Session: ${String(sess.sessionId).slice(0, 8)}...`);
      console.log(`  UAID: ${sess.uaid}`);
      console.log('');
    }

    console.log('View conversation: npx @hol-org/registry history <uaid>');
    console.log('Clear sessions: npx @hol-org/registry history clear');
    console.log('\nNote: Broker history expires after 15 minutes of inactivity.');
  }
}

