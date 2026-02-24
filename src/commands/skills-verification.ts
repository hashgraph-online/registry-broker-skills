import { REGISTRY_BROKER_API_KEY } from '../config';
import { ensureBrokerApiKey } from '../auth';
import { loadIdentity } from '../identity';
import { createRbClient } from '../rb';
import { parseOpt } from './skills-utils';
import {
  printSkillVerificationRequestCreated,
  printSkillVerificationStatus,
} from './skills-output';

const isVerificationTier = (value: string): value is SkillVerificationTier =>
  value === 'basic' || value === 'express';

type SkillVerificationTier = 'basic' | 'express';

type SkillVerificationRequestLike = {
  id?: string;
  name?: string;
  tier?: string;
  status?: string;
  usdCents?: number;
  creditsCharged?: number;
  createdAt?: string;
  updatedAt?: string;
  version?: string;
};

type SkillVerificationRequestCreateResponseLike = {
  request: SkillVerificationRequestLike;
};

type SkillVerificationStatusResponseLike = {
  name?: string;
  verified?: boolean;
  previouslyVerified?: boolean;
  pendingRequest?: SkillVerificationRequestLike | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSkillVerificationRequestLike = (
  value: unknown,
): value is SkillVerificationRequestLike => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.name !== 'string') {
    return false;
  }
  if (typeof value.tier !== 'string') {
    return false;
  }
  if (typeof value.status !== 'string') {
    return false;
  }
  return true;
};

const isSkillVerificationCreateResponseLike = (
  value: unknown,
): value is SkillVerificationRequestCreateResponseLike => {
  if (!isRecord(value)) {
    return false;
  }
  return isSkillVerificationRequestLike(value.request);
};

const isSkillVerificationStatusResponseLike = (
  value: unknown,
): value is SkillVerificationStatusResponseLike => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.name !== 'string') {
    return false;
  }
  if (typeof value.verified !== 'boolean') {
    return false;
  }
  if (typeof value.previouslyVerified !== 'boolean') {
    return false;
  }
  if (value.pendingRequest === undefined || value.pendingRequest === null) {
    return true;
  }
  return isSkillVerificationRequestLike(value.pendingRequest);
};

type SkillsVerificationContext = {
  subcommand: string;
  args: string[];
  jsonMode: boolean;
};

const resolveAuthedClient = async (): Promise<ReturnType<typeof createRbClient>> => {
  const identity = loadIdentity();
  const apiKey =
    REGISTRY_BROKER_API_KEY ||
    (identity ? await ensureBrokerApiKey(identity) : null);
  if (!apiKey) {
    throw new Error(
      'No API key found. Set REGISTRY_BROKER_API_KEY or authenticate via `claim`.',
    );
  }
  return createRbClient({ apiKey });
};

export async function handleSkillsVerification(
  context: SkillsVerificationContext,
): Promise<boolean> {
  if (
    context.subcommand !== 'verify' &&
    context.subcommand !== 'verification-status'
  ) {
    return false;
  }

  if (context.subcommand === 'verify') {
    const parsedName = parseOpt(context.args, '--name');
    let rest = parsedName.rest;
    const parsedTier = parseOpt(rest, '--tier');
    rest = parsedTier.rest;
    const parsedAccount = parseOpt(rest, '--account-id');
    rest = parsedAccount.rest;

    const name = parsedName.value ?? rest[0];
    if (!name) {
      console.error(
        'Usage: skills verify --name <skillName> [--tier <basic|express>] [--account-id <id>] [--json]',
      );
      process.exit(1);
    }

    const tierCandidate = (parsedTier.value ?? 'basic').toLowerCase();
    if (!isVerificationTier(tierCandidate)) {
      console.error('Error: --tier must be one of: basic, express');
      process.exit(1);
    }

    const client = await resolveAuthedClient();
    const response = await client.requestJson('/skills/verification/request', {
      method: 'POST',
      body: {
        name,
        tier: tierCandidate,
        ...(parsedAccount.value ? { accountId: parsedAccount.value } : {}),
      },
      headers: { 'content-type': 'application/json' },
    });

    if (context.jsonMode) {
      console.log(JSON.stringify(response, null, 2));
      return true;
    }

    if (!isSkillVerificationCreateResponseLike(response)) {
      throw new Error(
        'Unexpected response shape from /skills/verification/request.',
      );
    }

    printSkillVerificationRequestCreated(response.request);
    return true;
  }

  const parsedName = parseOpt(context.args, '--name');
  let rest = parsedName.rest;
  const parsedAccount = parseOpt(rest, '--account-id');
  rest = parsedAccount.rest;
  const name = parsedName.value ?? rest[0];
  if (!name) {
    console.error(
      'Usage: skills verification-status --name <skillName> [--account-id <id>] [--json]',
    );
    process.exit(1);
  }

  const client = await resolveAuthedClient();
  const query = new URLSearchParams({
    name,
    ...(parsedAccount.value ? { accountId: parsedAccount.value } : {}),
  });
  const response = await client.requestJson(
    `/skills/verification/status?${query.toString()}`,
    { method: 'GET' },
  );

  if (context.jsonMode) {
    console.log(JSON.stringify(response, null, 2));
    return true;
  }

  if (!isSkillVerificationStatusResponseLike(response)) {
    throw new Error('Unexpected response shape from /skills/verification/status.');
  }

  printSkillVerificationStatus(response);
  return true;
}
