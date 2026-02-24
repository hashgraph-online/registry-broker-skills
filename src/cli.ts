import fs from 'fs';

import { installConsoleStyling } from './ui/console';
import { HELP } from './help';
import { parseArgValue, parseRegisterOptions } from './args';
import { getDefaultSenderUaid } from './default-sender';
import { importPrivateKey, loadIdentity } from './identity';
import { KEY_FILE } from './paths';

import { search } from './commands/search';
import { chat } from './commands/chat';
import { resolve } from './commands/resolve';
import { stats } from './commands/stats';
import { balance } from './commands/balance';
import { check } from './commands/check';
import { skill } from './commands/skill';
import { handleSkills } from './commands/skills';
import { showHistory } from './commands/history';
import { listPublicSessions, manageSession, sessions } from './commands/session';
import { registerOwnedAgent, registerStatus } from './commands/register';
import {
  claim,
  claimComplete,
  claimWithApiKey,
  refreshKey,
  whoami,
} from './moltbook';
import { xmtpRoundtrip } from './xmtp/roundtrip';

type SenderParse = { senderUaid: string | null; args: string[] };

function isHelpFlag(value: string | undefined): boolean {
  return value === '--help' || value === '-h';
}

function parseSenderUaid(argList: string[], recipientUaid: string | null) {
  const idx = argList.findIndex((arg) => arg === '--as');
  if (idx === -1) {
    const defaultUaid = getDefaultSenderUaid(recipientUaid);
    return { senderUaid: defaultUaid, args: argList } satisfies SenderParse;
  }
  const value = argList[idx + 1];
  if (!value) {
    console.error('Error: --as requires a UAID value.');
    process.exit(1);
  }
  const filtered = argList.filter((_, i) => i !== idx && i !== idx + 1);
  return { senderUaid: value.trim(), args: filtered } satisfies SenderParse;
}

function parseComplete(argList: string[]) {
  const idx = argList.findIndex((a) => a === '--complete');
  if (idx !== -1 && argList[idx + 1]) {
    const challengeId = argList[idx + 1];
    const filtered = argList.filter((_, i) => i !== idx && i !== idx + 1);
    return { challengeId, args: filtered };
  }
  return { challengeId: null as string | null, args: argList };
}

function parseApiKey(argList: string[]) {
  const idxArg = argList.findIndex((a) => a === '--api-key');
  const idxStdin = argList.findIndex((a) => a === '--api-key-stdin');

  if (idxArg !== -1 && idxStdin !== -1) {
    console.error('Error: Use either --api-key or --api-key-stdin (not both).');
    process.exit(1);
  }

  if (idxArg !== -1) {
    const value = argList[idxArg + 1];
    if (!value) {
      console.error('Error: --api-key requires a value.');
      process.exit(1);
    }
    console.warn(
      'Warning: Passing Moltbook API keys via CLI args can leak into shell history and process lists.',
    );
    console.warn('Prefer MOLTBOOK_API_KEY=... or --api-key-stdin when possible.');
    const filtered = argList.filter((_, i) => i !== idxArg && i !== idxArg + 1);
    return { apiKey: value.trim(), args: filtered };
  }

  if (idxStdin !== -1) {
    const filtered = argList.filter((_, i) => i !== idxStdin);
    const raw = fs.readFileSync(0, 'utf-8').trim();
    if (!raw) {
      console.error('Error: --api-key-stdin received empty input.');
      process.exit(1);
    }
    return { apiKey: raw, args: filtered };
  }

  const envKey = process.env.MOLTBOOK_API_KEY;
  if (envKey && envKey.trim()) {
    return { apiKey: envKey.trim(), args: argList };
  }

  return { apiKey: null as string | null, args: argList };
}

function parseChatOptions(argList: string[]) {
  let rest = [...argList];
  const jsonMode = rest.includes('--json');
  rest = rest.filter((a) => a !== '--json');

  const parsedTransport = parseArgValue(rest, '--transport');
  rest = parsedTransport.args;
  const transport = parsedTransport.value;
  if (transport) {
    const normalized = transport.trim().toLowerCase();
    const allowed = ['xmtp', 'moltbook', 'http', 'a2a', 'acp'];
    if (!allowed.includes(normalized)) {
      console.error(`Error: --transport must be one of: ${allowed.join(', ')}`);
      process.exit(1);
    }
  }

  const parsedAgentUrl = parseArgValue(rest, '--agent-url');
  rest = parsedAgentUrl.args;
  const agentUrl = parsedAgentUrl.value;

  return {
    json: jsonMode,
    transport: transport ? transport.trim().toLowerCase() : null,
    agentUrl: agentUrl ? agentUrl.trim() : null,
    args: rest,
  };
}

export async function main() {
  installConsoleStyling();

  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();
  const subCommand = args[1]?.toLowerCase();

  if (command === undefined || command === 'help' || isHelpFlag(command)) {
    console.log(HELP);
    return;
  }

  if (isHelpFlag(subCommand)) {
    if (command === 'skills') {
      await handleSkills(args.slice(1));
      return;
    }
    console.log(HELP);
    return;
  }

  try {
    switch (command) {
      case 'search':
        if (!args[1]) {
          console.error('Usage: search <query> [limit]');
          process.exit(1);
        }
        await search(args[1], parseInt(args[2] ?? '', 10) || 5);
        break;

      case 'chat': {
        let rest = args.slice(1);

        const parsedOptions = parseChatOptions(rest);
        rest = parsedOptions.args;

        let recipientUaid: string | null = null;
        if (!parsedOptions.agentUrl) {
          let recipientIdx = 0;
          const asIdx = rest.findIndex((arg) => arg === '--as');
          if (asIdx !== -1) {
            recipientIdx = asIdx + 2;
          }
          recipientUaid = rest[recipientIdx] || null;
          if (!recipientUaid) {
            console.error(
              'Usage: chat [--transport <transport>] [--agent-url <url>] [--as <senderUaid>] [--json] <uaid> [message]',
            );
            process.exit(1);
          }
        }

        const parsedSender = parseSenderUaid(rest, recipientUaid);
        const senderUaid = parsedSender.senderUaid;
        rest = parsedSender.args;

        if (parsedOptions.agentUrl) {
          const maybeUaid =
            typeof rest[0] === 'string' && rest[0].startsWith('uaid:')
              ? rest[0]
              : null;
          const message = (maybeUaid ? rest.slice(1) : rest).join(' ') || null;
          await chat(maybeUaid ?? 'agent-url', message, {
            senderUaid,
            json: parsedOptions.json,
            transport: parsedOptions.transport,
            agentUrl: parsedOptions.agentUrl,
          });
          break;
        }

        const uaid = rest[0];
        const message = rest.slice(1).join(' ') || null;
        await chat(uaid, message, {
          senderUaid,
          json: parsedOptions.json,
          transport: parsedOptions.transport,
          agentUrl: null,
        });
        break;
      }

      case 'xmtp-roundtrip': {
        let rest = args.slice(1);
        const jsonMode = rest.includes('--json');
        rest = rest.filter((a) => a !== '--json');

        const parsedTitle = parseArgValue(rest, '--title');
        rest = parsedTitle.args;
        const parsedTags = parseArgValue(rest, '--tags');
        rest = parsedTags.args;
        const parsedCategories = parseArgValue(rest, '--categories');
        rest = parsedCategories.args;
        const parsedReply = parseArgValue(rest, '--reply');
        rest = parsedReply.args;

        const fromUaid = rest[0];
        const toUaid = rest[1];
        const message = rest.slice(2).join(' ');

        if (!fromUaid || !toUaid || !message) {
          console.error(
            'Usage: xmtp-roundtrip <fromUaid> <toUaid> <message> [--title <text>] [--tags <list>] [--categories <list>] [--reply <text>] [--json]',
          );
          process.exit(1);
        }

        try {
          const result = await xmtpRoundtrip(fromUaid, toUaid, message, {
            title: parsedTitle.value ?? undefined,
            tags: parsedTags.value ?? undefined,
            categories: parsedCategories.value ?? undefined,
            reply: parsedReply.value ?? undefined,
          });

          if (jsonMode) {
            console.log(JSON.stringify(result, null, 2));
            break;
          }

          console.log('\nXMTP roundtrip complete.\n');
          console.log(`  Session: ${result.sessionId}`);
          console.log('  Public chat URLs (try in browser):');
          result.publicUrlCandidates.forEach((candidate) => {
            console.log(`    - ${candidate}`);
          });
          console.log();
        } catch (error) {
          console.error(
            `XMTP roundtrip failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exit(1);
        }
        break;
      }

      case 'history': {
        const subCommand = args[1];
        if (subCommand === 'clear') {
          await showHistory(null, true);
        } else {
          await showHistory(subCommand || null, false);
        }
        break;
      }

      case 'sessions': {
        const uaidArg = args[1] || null;
        await sessions(uaidArg);
        break;
      }

      case 'public': {
        await listPublicSessions();
        break;
      }

      case 'session': {
        const sessionId = args[1];
        let rest = args.slice(2);

        const parsedSender = parseSenderUaid(rest, null);
        const senderUaid = parsedSender.senderUaid;
        rest = parsedSender.args;

        const parsedHistoryScope = parseArgValue(rest, '--history-scope');
        rest = parsedHistoryScope.args;
        const historyScope = parsedHistoryScope.value
          ? parsedHistoryScope.value.trim().toLowerCase()
          : null;
        if (historyScope) {
          const allowed = ['all', 'current_chat'];
          if (!allowed.includes(historyScope)) {
            console.error(
              `Error: --history-scope must be one of: ${allowed.join(', ')}`,
            );
            process.exit(1);
          }
        }

        const parsedTitle = parseArgValue(rest, '--title');
        rest = parsedTitle.args;
        const parsedTags = parseArgValue(rest, '--tags');
        rest = parsedTags.args;
        const parsedCategories = parseArgValue(rest, '--categories');
        rest = parsedCategories.args;

        const action = rest[0];
        const value = rest[1];

        if (!sessionId || !action) {
          console.error(
            'Usage: session <sessionId> <action> [value] [--as <senderUaid>] [--history-scope <scope>]',
          );
          console.error('Actions: set-public, set-private, set-labels, invite <uaid>');
          process.exit(1);
        }

        await manageSession(sessionId, action, {
          inviteeUaid: value,
          senderUaid,
          historyScope,
          title: parsedTitle.value,
          tags: parsedTags.value,
          categories: parsedCategories.value,
        });
        break;
      }

      case 'claim': {
        const { apiKey, args: afterApiKey } = parseApiKey(args.slice(1));
        const { challengeId, args: restArgs } = parseComplete(afterApiKey);
        const uaid = restArgs[0];

        if (apiKey) {
          await claimWithApiKey(apiKey);
        } else if (challengeId && uaid) {
          await claimComplete(uaid, challengeId);
        } else if (uaid) {
          await claim(uaid);
        } else {
          console.error('Usage:');
          console.error(
            '  claim                               # Automated (uses MOLTBOOK_API_KEY env var; never sent to broker)',
          );
          console.error(
            '  claim --api-key <key>               # Automated (CLI arg; used only for Moltbook API, never sent to broker)',
          );
          console.error(
            '  claim --api-key-stdin               # Automated (read key from stdin; used only for Moltbook API, never sent to broker)',
          );
          console.error('  claim <uaid>                         # Manual 2-step process');
          console.error('  claim <uaid> --complete <challengeId>');
          process.exit(1);
        }
        break;
      }

      case 'register': {
        const parsed = parseRegisterOptions(args.slice(1));
        const uaid = parsed.args[0] ?? getDefaultSenderUaid();
        if (!uaid) {
          console.error(
            'Usage: register [--json] [--name <name>] [--description <text>] [--endpoint <url>] [--metadata-json <json>] <uaid>',
          );
          console.error(
            'Tip: run `claim` first to add a Moltbook agent to your claimed list.',
          );
          process.exit(1);
        }
        await registerOwnedAgent(uaid, parsed);
        break;
      }

      case 'register-status': {
        const parsed = parseRegisterOptions(args.slice(1));
        const uaid = parsed.args[0] ?? getDefaultSenderUaid();
        if (!uaid) {
          console.error('Usage: register-status [--json] <uaid>');
          process.exit(1);
        }
        await registerStatus(uaid, parsed);
        break;
      }

      case 'whoami':
        await whoami();
        break;

      case 'refresh-key':
        await refreshKey();
        break;

      case 'import-key': {
        const existingIdentity = loadIdentity();
        if (existingIdentity) {
          console.log('\nYou already have an identity:');
          console.log(`  Address: ${existingIdentity.address}`);
          console.log(`  Created: ${existingIdentity.createdAt}`);
          console.log(`\nTo import a new key, first delete: ${KEY_FILE}`);
          process.exit(1);
        }

        const keyFromEnv = process.env.HOL_PRIVATE_KEY;
        if (keyFromEnv) {
          importPrivateKey(keyFromEnv);
          console.log('Identity imported successfully from HOL_PRIVATE_KEY.');
        } else {
          console.log('\nTo import an existing private key:');
          console.log('  HOL_PRIVATE_KEY=0x... npx @hol-org/registry import-key');
          console.log('\nOr set it before running any command:');
          console.log('  export HOL_PRIVATE_KEY=0x...');
          console.log('  npx @hol-org/registry claim');
        }
        break;
      }

      case 'resolve':
        if (!args[1]) {
          console.error('Usage: resolve <uaid>');
          process.exit(1);
        }
        await resolve(args[1]);
        break;

      case 'check':
        if (!args[1]) {
          console.error('Usage: check <uaid>');
          process.exit(1);
        }
        await check(args[1]);
        break;

      case 'stats':
        await stats();
        break;

      case 'balance':
        await balance();
        break;

      case 'skill':
        skill(args[1] === '--json');
        break;

      case 'skills':
        await handleSkills(args.slice(1));
        break;

      case 'help':
      case '--help':
      case '-h':
      case undefined:
        console.log(HELP);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}
