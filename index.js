/**
 * HOL Registry
 *
 * Programmatic access to the Universal Agentic Registry.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Skill file URL
 */
export const SKILL_URL = 'https://hol.org/registry/skill.md';

/**
 * Skill JSON URL
 */
export const SKILL_JSON_URL = 'https://hol.org/registry/skill.json';

/**
 * API Base URL
 */
export const API_BASE_URL = 'https://hol.org/registry/api/v1';

/**
 * Get the skill file content
 */
export function getSkillContent() {
  return readFileSync(join(__dirname, 'SKILL.md'), 'utf-8');
}

/**
 * Get the skill.json content
 */
export function getSkillJson() {
  return JSON.parse(readFileSync(join(__dirname, 'skill.json'), 'utf-8'));
}

/**
 * Simple client for the Registry Broker API
 */
export class RegistryBrokerClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || API_BASE_URL;
    this.apiKey = options.apiKey || process.env.REGISTRY_BROKER_API_KEY;
    this.defaultTransport = options.transport || 'xmtp';
  }

  async search(query, options = {}) {
    const params = new URLSearchParams({
      q: query,
      limit: String(options.limit || 10),
      ...options,
    });
    const response = await fetch(`${this.baseUrl}/search?${params}`);
    return response.json();
  }

  async getAgent(uaid) {
    const response = await fetch(
      `${this.baseUrl}/agents/${encodeURIComponent(uaid)}`
    );
    return response.json();
  }

  async resolve(uaid) {
    const response = await fetch(
      `${this.baseUrl}/resolve/${encodeURIComponent(uaid)}`
    );
    return response.json();
  }

  async createChatSession(uaid, options = {}) {
    if (!this.apiKey) {
      throw new Error('API key required for chat operations');
    }
    const transport = options.transport || this.defaultTransport;
    const response = await fetch(`${this.baseUrl}/chat/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({ uaid, transport }),
    });
    return response.json();
  }

  async sendMessage(sessionId, message) {
    if (!this.apiKey) {
      throw new Error('API key required for chat operations');
    }
    const response = await fetch(`${this.baseUrl}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({ sessionId, message }),
    });
    return response.json();
  }

  async endSession(sessionId) {
    if (!this.apiKey) {
      throw new Error('API key required for chat operations');
    }
    await fetch(`${this.baseUrl}/chat/session/${sessionId}`, {
      method: 'DELETE',
      headers: { 'x-api-key': this.apiKey },
    });
  }

  async getStats() {
    const response = await fetch(`${this.baseUrl}/stats`);
    return response.json();
  }

  async getBalance() {
    if (!this.apiKey) {
      throw new Error('API key required for balance check');
    }
    const response = await fetch(`${this.baseUrl}/credits/balance`, {
      headers: { 'x-api-key': this.apiKey },
    });
    return response.json();
  }
}

export default {
  SKILL_URL,
  SKILL_JSON_URL,
  API_BASE_URL,
  getSkillContent,
  getSkillJson,
  RegistryBrokerClient,
};
