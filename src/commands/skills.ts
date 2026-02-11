import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import type {
  SkillRegistryFileInput,
  SkillRegistryJobStatusResponse,
} from '@hol-org/rb-client';

import { RegistryBrokerError } from '@hol-org/rb-client';

import { REGISTRY_BROKER_API_KEY } from '../config';
import { ensureBrokerApiKey } from '../auth';
import { loadIdentity } from '../identity';
import { createRbClient } from '../rb';
import { initSkillPackage, parseFlag, parseOpt } from './skills-utils';
import {
  printSkillItem,
  printSkillList,
  printMySkillsList,
  printSkillsConfig,
  printSkillsInitResult,
  printSkillsValidateResult,
} from './skills-output';
import type { SkillsMyListResponseLike } from './skills-output';
import { validateSkillPackage } from './skills-validate';

const SKILLS_HELP = `Usage: skills <config|list|get|init|validate|my-list|upvote|unupvote|vote-status|quote|publish|job|ownership> [...args] [--json]

Subcommands:
  skills config
  skills get --name <name> [--version <version>] [--include-files]
  skills init --dir <path> --name <name> --version <version> [--description <text>] [--force]
  skills validate --dir <skillDir>
  skills list [--name <name>] [--version <version>] [--limit <n>] [--cursor <cursor>] [--include-files]
  skills my-list [--limit <n>] [--cursor <cursor>] [--account-id <id>]
  skills upvote --name <skillName>
  skills unupvote --name <skillName>
  skills vote-status --name <skillName>
  skills quote --dir <skillDir> [--name <name>] [--version <version>] [--account-id <id>]
  skills publish --dir <skillDir> [--name <name>] [--version <version>] [--account-id <id>] [--quote-only]
  skills job <jobId> [--account-id <id>]
  skills ownership --name <skillName> [--account-id <id>]

Notes:
  - skills list is public (no API key required).
  - skills my-list requires an API key.
  - skills upvote/unupvote/vote-status require an API key.
  - skills quote/publish/job/ownership require an API key.
  - when using static API keys, job status typically requires --account-id to authorize access.
`;

const guessMimeType = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return 'text/markdown';
  }
  if (lower.endsWith('.json')) {
    return 'application/json';
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return 'text/yaml';
  }
  if (lower.endsWith('.txt')) {
    return 'text/plain';
  }
  return 'application/octet-stream';
};

const rewriteSkillJson = (
  raw: Buffer<ArrayBufferLike>,
  overrides: { name?: string; version?: string },
): Buffer<ArrayBufferLike> => {
  if (!overrides.name && !overrides.version) {
    return raw;
  }
  const parsed = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
  if (overrides.name) {
    parsed.name = overrides.name;
  }
  if (overrides.version) {
    parsed.version = overrides.version;
  }
  return Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSkillsMyListResponseLike = (value: unknown): value is SkillsMyListResponseLike => {
  if (!isRecord(value)) {
    return false;
  }
  const owned = value.owned;
  const upvoted = value.upvoted;
  if (!isRecord(owned) || !isRecord(upvoted)) {
    return false;
  }
  const ownedItems = owned.items;
  const upvotedItems = upvoted.items;
  if (!Array.isArray(ownedItems) || !Array.isArray(upvotedItems)) {
    return false;
  }
  return true;
};

type SkillsVoteStatusResponseLike = {
  name?: string | null;
  upvotes?: number | null;
  hasUpvoted?: boolean | null;
};

const isSkillsVoteStatusResponseLike = (
  value: unknown,
): value is SkillsVoteStatusResponseLike => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.upvotes !== 'number') {
    return false;
  }
  if (typeof value.hasUpvoted !== 'boolean') {
    return false;
  }
  return true;
};

const loadSkillFiles = async (
  skillDir: string,
  overrides: { name?: string; version?: string },
): Promise<SkillRegistryFileInput[]> => {
  const entries = await readdir(skillDir);
  const files: SkillRegistryFileInput[] = [];

  for (const entry of entries) {
    if (entry.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(skillDir, entry);
    const fileStat = await stat(fullPath);
    if (!fileStat.isFile()) {
      continue;
    }
    let data: Buffer<ArrayBufferLike> = await readFile(fullPath);
    if (entry === 'skill.json') {
      data = rewriteSkillJson(data, overrides);
    }
    const lower = entry.toLowerCase();
    const role: SkillRegistryFileInput['role'] =
      entry === 'SKILL.md'
        ? 'skill-md'
        : entry === 'skill.json'
          ? 'skill-json'
          : lower === 'logo.png' ||
              lower === 'logo.jpg' ||
              lower === 'logo.jpeg' ||
              lower === 'logo.webp' ||
              lower === 'icon.png' ||
              lower === 'icon.jpg' ||
              lower === 'icon.jpeg' ||
              lower === 'icon.webp'
            ? 'skill-icon'
            : 'file';
    files.push({
      name: entry,
      base64: data.toString('base64'),
      mimeType: guessMimeType(entry),
      role,
    });
  }

  const names = new Set(files.map(file => file.name));
  if (!names.has('SKILL.md')) {
    throw new Error(`Missing SKILL.md in ${skillDir}`);
  }
  if (!names.has('skill.json')) {
    throw new Error(`Missing skill.json in ${skillDir}`);
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
};

const pollJob = async (params: {
  client: ReturnType<typeof createRbClient>;
  jobId: string;
  accountId?: string;
  timeoutMs?: number;
}): Promise<SkillRegistryJobStatusResponse> => {
  const started = Date.now();
  const timeoutMs = params.timeoutMs ?? 12 * 60_000;
  let lastStatus: string | null = null;

  while (Date.now() - started < timeoutMs) {
    const job = await params.client.getSkillPublishJob(params.jobId, {
      ...(params.accountId ? { accountId: params.accountId } : {}),
    });
    if (job.status !== lastStatus) {
      console.log(`• Job status: ${job.status}`);
      lastStatus = job.status;
    }
    if (job.status === 'completed') {
      return job;
    }
    if (job.status === 'failed') {
      throw new Error(job.failureReason ?? 'Job failed');
    }
    await delay(2_000);
  }

  throw new Error(`Job ${params.jobId} did not complete within ${timeoutMs}ms`);
};

export async function handleSkills(rawArgs: string[]): Promise<void> {
  try {
    if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
      console.log(SKILLS_HELP);
      return;
    }

    const sub = rawArgs[0]?.toLowerCase();
    if (!sub || sub === 'help') {
      console.log(SKILLS_HELP);
      return;
    }

    let rest = rawArgs.slice(1);
    const parsedJson = parseFlag(rest, '--json');
    const jsonMode = parsedJson.enabled;
    rest = parsedJson.rest;

    const client = createRbClient();

    if (sub === 'config') {
      const data = await client.skillsConfig();
      if (jsonMode) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      printSkillsConfig(data);
      return;
    }

    if (sub === 'get') {
      const parsedName = parseOpt(rest, '--name');
      rest = parsedName.rest;
      const parsedVersion = parseOpt(rest, '--version');
      rest = parsedVersion.rest;
      const parsedInclude = parseFlag(rest, '--include-files');
      rest = parsedInclude.rest;

      const name = parsedName.value ?? rest[0];
      if (!name) {
        console.error('Usage: skills get --name <name> [--version <version>] [--include-files] [--json]');
        process.exit(1);
      }

      const data = await client.listSkills({
        name,
        ...(parsedVersion.value ? { version: parsedVersion.value } : {}),
        ...(parsedInclude.enabled ? { includeFiles: true } : {}),
        limit: 20,
      });
      const item = data.items[0] ?? null;
      if (jsonMode) {
        console.log(JSON.stringify(item, null, 2));
        return;
      }
      printSkillItem(item);
      return;
    }

    if (sub === 'init') {
      const parsedDir = parseOpt(rest, '--dir');
      rest = parsedDir.rest;
      const parsedName = parseOpt(rest, '--name');
      rest = parsedName.rest;
      const parsedVersion = parseOpt(rest, '--version');
      rest = parsedVersion.rest;
      const parsedDescription = parseOpt(rest, '--description');
      rest = parsedDescription.rest;
      const parsedForce = parseFlag(rest, '--force');
      rest = parsedForce.rest;

      const dir = parsedDir.value ?? rest[0];
      const name = parsedName.value ?? null;
      const version = parsedVersion.value ?? null;
      const description = parsedDescription.value ?? 'A Registry Broker skill package.';

      if (!dir || !name || !version) {
        console.error('Usage: skills init --dir <path> --name <name> --version <version> [--description <text>] [--force]');
        process.exit(1);
      }

      const result = await initSkillPackage({
        dir,
        name,
        version,
        description,
        force: parsedForce.enabled,
      });
      if (jsonMode) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      printSkillsInitResult(result);
      return;
    }

    if (sub === 'validate') {
      const parsedDir = parseOpt(rest, '--dir');
      rest = parsedDir.rest;
      const dir = parsedDir.value ?? rest[0];
      if (!dir) {
        console.error('Usage: skills validate --dir <skillDir> [--json]');
        process.exit(1);
      }
      const result = await validateSkillPackage(client, dir);
      if (jsonMode) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      printSkillsValidateResult(result);
      return;
    }

    if (sub === 'list') {
      const parsedName = parseOpt(rest, '--name');
      rest = parsedName.rest;
      const parsedVersion = parseOpt(rest, '--version');
      rest = parsedVersion.rest;
      const parsedLimit = parseOpt(rest, '--limit');
      rest = parsedLimit.rest;
      const parsedCursor = parseOpt(rest, '--cursor');
      rest = parsedCursor.rest;
      const parsedInclude = parseFlag(rest, '--include-files');
      rest = parsedInclude.rest;

      const limit = parsedLimit.value ? Number(parsedLimit.value) : undefined;
      const data = await client.listSkills({
        ...(parsedName.value ? { name: parsedName.value } : {}),
        ...(parsedVersion.value ? { version: parsedVersion.value } : {}),
        ...(typeof limit === 'number' && Number.isFinite(limit) ? { limit } : {}),
        ...(parsedCursor.value ? { cursor: parsedCursor.value } : {}),
        ...(parsedInclude.enabled ? { includeFiles: true } : {}),
      });

      if (jsonMode) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      printSkillList(data);
      return;
    }

    if (sub === 'my-list') {
      const parsedLimit = parseOpt(rest, '--limit');
      rest = parsedLimit.rest;
      const parsedCursor = parseOpt(rest, '--cursor');
      rest = parsedCursor.rest;
      const parsedAccount = parseOpt(rest, '--account-id');
      rest = parsedAccount.rest;

      const limit = parsedLimit.value ? Number(parsedLimit.value) : undefined;

      const identity = loadIdentity();
      const apiKey =
        REGISTRY_BROKER_API_KEY || (identity ? await ensureBrokerApiKey(identity) : null);
      if (!apiKey) {
        console.error('Error: No API key found.');
        console.error('Set REGISTRY_BROKER_API_KEY or authenticate via `claim`.');
        process.exit(1);
      }

      const authed = createRbClient({ apiKey });

      const params = new URLSearchParams();
      if (typeof limit === 'number' && Number.isFinite(limit)) {
        params.set('limit', String(limit));
      }
      if (parsedCursor.value) {
        params.set('cursor', parsedCursor.value);
      }
      const accountId = parsedAccount.value ?? identity?.address ?? null;
      if (accountId) {
        params.set('accountId', accountId);
      }

      const path = `/skills/my-list${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await authed.requestJson(path, { method: 'GET' });

      if (jsonMode) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      if (!isSkillsMyListResponseLike(data)) {
        console.error('Error: Unexpected response shape from /skills/my-list.');
        process.exit(1);
      }
      printMySkillsList(data);
      return;
    }

    if (sub === 'vote-status' || sub === 'upvote' || sub === 'unupvote') {
      const parsedName = parseOpt(rest, '--name');
      rest = parsedName.rest;
      const name = parsedName.value ?? rest[0];
      if (!name) {
        console.error(
          `Usage: skills ${sub} --name <skillName> [--json]`,
        );
        process.exit(1);
      }

      const identity = loadIdentity();
      const apiKey =
        REGISTRY_BROKER_API_KEY ||
        (identity ? await ensureBrokerApiKey(identity) : null);
      if (!apiKey) {
        console.error('Error: No API key found.');
        console.error('Set REGISTRY_BROKER_API_KEY or authenticate via `claim`.');
        process.exit(1);
      }

      const authed = createRbClient({ apiKey });

      if (sub === 'vote-status') {
        const params = new URLSearchParams({ name });
        const path = `/skills/vote?${params.toString()}`;
        const data = await authed.requestJson(path, { method: 'GET' });

        if (jsonMode) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }

        if (!isSkillsVoteStatusResponseLike(data)) {
          console.error('Error: Unexpected response shape from /skills/vote.');
          process.exit(1);
        }

        const status = data.hasUpvoted ? 'upvoted' : 'not upvoted';
        console.log(`${name}: ${status} (${data.upvotes} upvotes)`);
        return;
      }

      const upvoted = sub === 'upvote';
      const data = await authed.requestJson('/skills/vote', {
        method: 'POST',
        body: { name, upvoted },
      });

      if (jsonMode) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      if (!isSkillsVoteStatusResponseLike(data)) {
        console.error('Error: Unexpected response shape from /skills/vote.');
        process.exit(1);
      }

      const status = data.hasUpvoted ? 'upvoted' : 'not upvoted';
      console.log(`${name}: ${status} (${data.upvotes} upvotes)`);
      return;
    }

    if (sub === 'job') {
      const jobId = rest[0];
      if (!jobId) {
        console.error('Usage: skills job <jobId> [--account-id <accountId>] [--json]');
        process.exit(1);
      }
      const identity = loadIdentity();
      const apiKey =
        REGISTRY_BROKER_API_KEY || (identity ? await ensureBrokerApiKey(identity) : null);
      if (!apiKey) {
        console.error('Error: No API key found.');
        console.error('Set REGISTRY_BROKER_API_KEY or authenticate via `claim`.');
        process.exit(1);
      }
      const authed = createRbClient({ apiKey });
      const parsedAccount = parseOpt(rest.slice(1), '--account-id');
      const accountId = parsedAccount.value ?? identity?.address ?? null;
      const data = await authed.getSkillPublishJob(jobId, {
        ...(accountId ? { accountId } : {}),
      });
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (sub === 'ownership') {
      const parsedName = parseOpt(rest, '--name');
      rest = parsedName.rest;
      const parsedAccount = parseOpt(rest, '--account-id');
      rest = parsedAccount.rest;
      const name = parsedName.value ?? rest[0];
      if (!name) {
        console.error('Usage: skills ownership --name <skillName> [--account-id <id>] [--json]');
        process.exit(1);
      }

      const identity = loadIdentity();
      const apiKey =
        REGISTRY_BROKER_API_KEY || (identity ? await ensureBrokerApiKey(identity) : null);
      if (!apiKey) {
        console.error('Error: No API key found.');
        console.error('Set REGISTRY_BROKER_API_KEY or authenticate via `claim`.');
        process.exit(1);
      }
      const authed = createRbClient({ apiKey });
      const accountId = parsedAccount.value ?? identity?.address ?? null;
      const data = await authed.getSkillOwnership({
        name,
        ...(accountId ? { accountId } : {}),
      });
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (sub === 'quote' || sub === 'publish') {
      const parsedDir = parseOpt(rest, '--dir');
      rest = parsedDir.rest;
      const skillDir = parsedDir.value ?? rest[0];
      if (!skillDir) {
        console.error(`Usage: skills ${sub} --dir <skillDir> [--json]`);
        process.exit(1);
      }

      const parsedName = parseOpt(rest, '--name');
      rest = parsedName.rest;
      const parsedVersion = parseOpt(rest, '--version');
      rest = parsedVersion.rest;
      const parsedAccount = parseOpt(rest, '--account-id');
      rest = parsedAccount.rest;
      const parsedQuoteOnly = parseFlag(rest, '--quote-only');
      rest = parsedQuoteOnly.rest;

      const overrides = {
        ...(parsedName.value ? { name: parsedName.value } : {}),
        ...(parsedVersion.value ? { version: parsedVersion.value } : {}),
      };

      const identity = loadIdentity();
      const apiKey =
        REGISTRY_BROKER_API_KEY || (identity ? await ensureBrokerApiKey(identity) : null);
      if (!apiKey) {
        console.error('Error: No API key found.');
        console.error('Set REGISTRY_BROKER_API_KEY or authenticate via `claim`.');
        process.exit(1);
      }

      const authed = createRbClient({ apiKey });
      const files = await loadSkillFiles(skillDir, overrides);

      const accountId = parsedAccount.value ?? identity?.address ?? null;
      const quote = await authed.quoteSkillPublish({
        files,
        ...(accountId ? { accountId } : {}),
      });

      if (sub === 'quote' || parsedQuoteOnly.enabled) {
        console.log(JSON.stringify(quote, null, 2));
        return;
      }

      const published = await authed.publishSkill({
        files,
        quoteId: quote.quoteId,
        ...(accountId ? { accountId } : {}),
      });

      console.log(JSON.stringify(published, null, 2));

      if (published.jobId && !jsonMode) {
        const completed = await pollJob({
          client: authed,
          jobId: published.jobId,
          ...(accountId ? { accountId } : {}),
        });
        console.log(JSON.stringify(completed, null, 2));
      }
      return;
    }

    console.error(SKILLS_HELP);
    process.exit(1);
  } catch (err) {
    if (err instanceof RegistryBrokerError) {
      const body =
        typeof err.body === 'string'
          ? err.body
          : err.body
            ? JSON.stringify(err.body, null, 2)
            : '';
      console.error(`Error: ${err.message} (status ${err.status})`);
      if (body) {
        console.error(body);
      }
      process.exit(1);
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
