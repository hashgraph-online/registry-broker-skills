import { BASE_URL, REGISTRY_BROKER_API_KEY } from '../config';
import { ensureBrokerApiKey } from '../auth';
import { getOrCreateIdentity, loadIdentity } from '../identity';
import { createRbClient, requestJsonSafe } from '../rb';
import { getDefaultSenderUaid } from '../default-sender';
import { getRelativeTime } from '../utils/time';

export async function manageSession(
  sessionId: string,
  action: string,
  value: {
    inviteeUaid?: string | null;
    senderUaid?: string | null;
    historyScope?: string | null;
    title?: string | null;
    tags?: string | null;
    categories?: string | null;
  },
) {
  const identity = getOrCreateIdentity();
  const apiKey = REGISTRY_BROKER_API_KEY || (await ensureBrokerApiKey(identity));
  const client = createRbClient({ apiKey });

  const senderUaid =
    typeof value?.senderUaid === 'string' && value.senderUaid.trim()
      ? value.senderUaid.trim()
      : getDefaultSenderUaid();
  if (!senderUaid) {
    console.error('You must have a claimed agent to manage sessions.');
    return;
  }

  try {
    const title = typeof value?.title === 'string' ? value.title.trim() : '';
    const parseCsv = (raw: unknown) => {
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      if (!trimmed) return [];
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 50);
    };
    const tags = parseCsv(value?.tags);
    const categories = parseCsv(value?.categories);

    if (action === 'set-public' || action === 'set-private') {
      const visibility = action === 'set-public' ? 'public' : 'private';
      const body: Record<string, unknown> = {
        visibility,
        senderUaid,
        ...(title ? { title } : {}),
        ...(tags ? { tags } : {}),
        ...(categories ? { categories } : {}),
      };

      const res = await requestJsonSafe(
        client,
        `/chat/session/${encodeURIComponent(sessionId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body,
        },
      );

      if (!res.ok) {
        const message =
          res?.data &&
          typeof res.data === 'object' &&
          'error' in res.data &&
          (res.data as any).error
            ? String((res.data as any).error)
            : res.error || `HTTP ${res.status}`;
        console.error(`Failed to update session: ${message}`);
        return;
      }

      console.log(`Session ${sessionId} is now ${(res.data as any).visibility}.`);
    } else if (action === 'set-labels') {
      if (
        !title &&
        (!tags || tags.length === 0) &&
        (!categories || categories.length === 0)
      ) {
        console.error(
          'Usage: session <id> set-labels --title "..." --tags "a,b" --categories "c,d"',
        );
        return;
      }

      const body: Record<string, unknown> = {
        senderUaid,
        ...(title ? { title } : {}),
        ...(tags ? { tags } : {}),
        ...(categories ? { categories } : {}),
      };

      const res = await requestJsonSafe(
        client,
        `/chat/session/${encodeURIComponent(sessionId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body,
        },
      );

      if (!res.ok) {
        const message =
          res?.data &&
          typeof res.data === 'object' &&
          'error' in res.data &&
          (res.data as any).error
            ? String((res.data as any).error)
            : res.error || `HTTP ${res.status}`;
        console.error(`Failed to update session: ${message}`);
        return;
      }

      const data: any = res.data;
      console.log(`Updated labels for session ${sessionId}.`);
      if (Array.isArray(data.tags) && data.tags.length > 0) {
        console.log(`  Tags: ${data.tags.join(', ')}`);
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        console.log(`  Categories: ${data.categories.join(', ')}`);
      }
      if (typeof data.title === 'string' && data.title.trim()) {
        console.log(`  Title: ${data.title}`);
      }
    } else if (action === 'invite') {
      const invitee =
        typeof value?.inviteeUaid === 'string' ? value.inviteeUaid.trim() : '';
      if (!invitee) {
        console.error('Usage: session <id> invite <uaid>');
        return;
      }

      const body: Record<string, unknown> = {
        uaid: invitee,
        senderUaid,
      };
      if (typeof value?.historyScope === 'string' && value.historyScope.trim()) {
        body.historyScope = value.historyScope.trim();
      }

      const res = await requestJsonSafe(
        client,
        `/chat/session/${encodeURIComponent(sessionId)}/invite`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        },
      );

      if (!res.ok) {
        const message =
          res?.data &&
          typeof res.data === 'object' &&
          'error' in res.data &&
          (res.data as any).error
            ? String((res.data as any).error)
            : res.error || `HTTP ${res.status}`;
        console.error(`Failed to invite agent: ${message}`);
        return;
      }

      console.log(`Invited ${invitee} to session ${sessionId}.`);
    } else {
      console.error('Unknown action. Use: set-public, set-private, set-labels, invite');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error managing session:', message);
  }
}

export async function listPublicSessions() {
  const client = createRbClient();

  try {
    const res = await requestJsonSafe(client, '/chat/public?limit=20', {
      method: 'GET',
    });
    if (!res.ok) {
      const message =
        res?.data &&
        typeof res.data === 'object' &&
        'error' in res.data &&
        (res.data as any).error
          ? String((res.data as any).error)
          : res.error || `HTTP ${res.status}`;
      console.error(`Failed to list public sessions: ${message}`);
      return;
    }

    const data: any = res.data;
    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      console.log('\nNo public chat sessions found.');
      return;
    }

    console.log(`\n=== Public Chat Sessions (${sessions.length}) ===\n`);

    const baseSiteUrl = BASE_URL.replace(/\/api\/v1\/?$/, '');
    for (const sess of sessions) {
      const created = new Date(sess.createdAt);
      const relativeTime = getRelativeTime(created);

      console.log(`Session: ${sess.sessionId}`);
      console.log(`  Created: ${relativeTime}`);
      const members = Array.isArray(sess.memberUaids) ? sess.memberUaids : [];
      console.log(`  Participants: ${members.length}`);
      if (typeof sess.lastMessagePreview === 'string' && sess.lastMessagePreview.trim()) {
        console.log(`  Last: ${sess.lastMessagePreview.trim().slice(0, 120)}`);
      }
      const tags = Array.isArray(sess.tags) ? sess.tags : [];
      const categories = Array.isArray(sess.categories) ? sess.categories : [];
      if (tags.length > 0) console.log(`  Tags: ${tags.join(', ')}`);
      if (categories.length > 0) console.log(`  Categories: ${categories.join(', ')}`);
      console.log(`  Link: ${baseSiteUrl}/chats/public/${sess.sessionId}`);
      console.log('');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error listing public sessions:', message);
  }
}

export async function sessions(uaidFilter: string | null = null) {
  const identity = loadIdentity();

  if (!identity) {
    console.log('\nNo identity found.');
    console.log('Run "claim <uaid>" to create an identity first.\n');
    return;
  }

  const apiKey = REGISTRY_BROKER_API_KEY || (await ensureBrokerApiKey(identity));
  const client = createRbClient({ apiKey });

  let uaid = uaidFilter;
  if (!uaid && (identity as any).claimedAgents && (identity as any).claimedAgents.length > 0) {
    uaid = (identity as any).claimedAgents[0];
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
    const data: any = await client.requestJson(
      `/chat/sessions?uaid=${encodeURIComponent(uaid)}&limit=50`,
      { method: 'GET' },
    );
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
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to fetch sessions: ${message}`);
    process.exit(1);
  }
}

