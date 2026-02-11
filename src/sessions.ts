import fs from 'fs';

import { SESSIONS_FILE } from './paths';
import { ensureKeyDir } from './identity';

type SessionInfo = {
  sessionId: string;
  agentName: string;
  transport: string | null;
  createdAt: string;
  lastUsedAt: string;
};

type SessionsData = {
  sessions: Record<string, SessionInfo>;
};

export function loadSessions(): SessionsData {
  if (!fs.existsSync(SESSIONS_FILE)) {
    return { sessions: {} };
  }
  try {
    const content = fs.readFileSync(SESSIONS_FILE, 'utf-8');
    return JSON.parse(content) as SessionsData;
  } catch {
    return { sessions: {} };
  }
}

export function saveSessions(data: SessionsData) {
  ensureKeyDir();
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function getSessionForUaid(uaid: string) {
  const data = loadSessions();
  return data.sessions[uaid] || null;
}

export function saveSessionForUaid(
  uaid: string,
  sessionId: string,
  agentName: string | null,
  transport: string | null,
) {
  const data = loadSessions();
  data.sessions[uaid] = {
    sessionId,
    agentName: agentName || uaid,
    transport: transport || null,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  };
  saveSessions(data);
}

export function clearSessions() {
  if (fs.existsSync(SESSIONS_FILE)) {
    fs.unlinkSync(SESSIONS_FILE);
  }
}

export function listSessions() {
  const data = loadSessions();
  return Object.entries(data.sessions).map(([uaid, info]) => ({ uaid, ...info }));
}

