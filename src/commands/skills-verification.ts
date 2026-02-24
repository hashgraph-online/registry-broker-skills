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
  id?: string | null;
  name?: string | null;
  tier?: string | null;
  status?: string | null;
  usdCents?: number | null;
  creditsCharged?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version?: string | null;
};

type SkillVerificationRequestCreateResponseLike = {
  request: SkillVerificationRequestLike;
};

type SkillVerificationStatusResponseLike = {
  name?: string | null;
  verified?: boolean | null;
  previouslyVerified?: boolean | null;
  pendingRequest?: SkillVerificationRequestLike | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOptionalString = (
  value: unknown,
): value is string | null | undefined =>
  value === undefined || value === null || typeof value === 'string';

const isOptionalNumber = (
  value: unknown,
): value is number | null | undefined =>
  value === undefined ||
  value === null ||
  (typeof value === 'number' && Number.isFinite(value));

const isOptionalBoolean = (
  value: unknown,
): value is boolean | null | undefined =>
  value === undefined || value === null || typeof value === 'boolean';

const isSkillVerificationRequestLike = (
  value: unknown,
): value is SkillVerificationRequestLike => {
  if (!isRecord(value)) {
    return false;
  }
  if (
    !isOptionalString(value.id) ||
    !isOptionalString(value.name) ||
    !isOptionalString(value.tier) ||
    !isOptionalString(value.status) ||
    !isOptionalString(value.createdAt) ||
    !isOptionalString(value.updatedAt) ||
    !isOptionalString(value.version) ||
    !isOptionalNumber(value.usdCents) ||
    !isOptionalNumber(value.creditsCharged)
  ) {
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
  if (!isOptionalString(value.name)) {
    return false;
  }
  if (!isOptionalBoolean(value.verified)) {
    return false;
  }
  if (!isOptionalBoolean(value.previouslyVerified)) {
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
