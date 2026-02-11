import os from 'os';
import path from 'path';

export const KEY_DIR = path.join(os.homedir(), '.hol-registry');
export const KEY_FILE = path.join(KEY_DIR, 'identity.json');
export const SESSIONS_FILE = path.join(KEY_DIR, 'sessions.json');

