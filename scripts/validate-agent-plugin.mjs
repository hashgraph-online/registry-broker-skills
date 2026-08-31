import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_SCHEMA =
  'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const MCP_SCHEMA =
  'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readText(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
  }
}

function assertObject(value, label) {
  assert(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `${label} must be an object`,
  );
}

function assertExactKeys(value, allowedKeys, label) {
  assertObject(value, label);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  assert(unknown.length === 0, `${label} has unknown fields: ${unknown.join(', ')}`);
}

function assertHttpsUrl(value, label, { allowFragment = true } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${label} must be an absolute URL`);
  }
  assert(url.protocol === 'https:', `${label} must use HTTPS`);
  assert(!url.username && !url.password, `${label} must not contain credentials`);
  if (!allowFragment) assert(!url.hash, `${label} must not contain a fragment`);
  return url;
}

const packageJson = readJson('package.json');
const plugin = readJson('plugin.json');
const mcp = readJson('mcp.json');

assertExactKeys(
  plugin,
  new Set([
    '$schema',
    'name',
    'version',
    'description',
    'author',
    'homepage',
    'repository',
    'license',
    'keywords',
    'extensions',
  ]),
  'plugin.json',
);
assert(plugin.$schema === PLUGIN_SCHEMA, 'plugin.json uses the wrong schema');
assert(
  /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(plugin.name) &&
    plugin.name.length <= 64,
  'plugin.json name violates Agent Plugins 1.0.0 constraints',
);
assert(
  plugin.version === packageJson.version,
  'plugin.json version must match package.json',
);
assert(
  typeof plugin.description === 'string' && plugin.description.length > 20,
  'plugin.json needs a useful description',
);
assert(
  plugin.description.includes('HOL Universal Agentic Registry'),
  'plugin.json must use the canonical product name',
);
assertExactKeys(
  plugin.author,
  new Set(['name', 'email', 'url']),
  'plugin.json author',
);
assert(plugin.author.name === 'HOL', 'plugin author must use the HOL brand');
assert(plugin.author.email === 'support@hol.org', 'plugin support email drifted');
assert(plugin.author.url === 'https://hol.org', 'plugin author URL drifted');
assert(plugin.homepage === 'https://hol.org/registry', 'plugin homepage drifted');
assert(
  plugin.repository ===
    'https://github.com/hashgraph-online/registry-broker-skills',
  'plugin repository drifted',
);
assert(plugin.license === 'Apache-2.0', 'plugin license drifted');
assertHttpsUrl(plugin.homepage, 'plugin homepage');
assertHttpsUrl(plugin.repository, 'plugin repository');
assert(
  Array.isArray(plugin.keywords) &&
    plugin.keywords.length >= 3 &&
    plugin.keywords.every((value) => typeof value === 'string' && value.length > 0),
  'plugin keywords must be a useful string array',
);
assert(
  new Set(plugin.keywords).size === plugin.keywords.length,
  'plugin keywords must be unique',
);

assertExactKeys(mcp, new Set(['$schema', 'mcpServers']), 'mcp.json');
assert(mcp.$schema === MCP_SCHEMA, 'mcp.json uses the wrong schema');
assertExactKeys(mcp.mcpServers, new Set(['hol-registry']), 'mcpServers');
const server = mcp.mcpServers['hol-registry'];
assertExactKeys(server, new Set(['type', 'url', 'headers']), 'hol-registry MCP server');
assert(server.type === 'streamable-http', 'HOL Registry MCP must use Streamable HTTP');
assert(
  server.url === 'https://hol.org/.well-known/mcp',
  'HOL Registry MCP URL drifted',
);
assertHttpsUrl(server.url, 'HOL Registry MCP URL', { allowFragment: false });
assert(server.headers === undefined, 'Public HOL Registry MCP must not embed headers');

const skillPath = 'skills/registry-broker/SKILL.md';
const skill = readText(skillPath);
const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/);
assert(frontmatter, `${skillPath} needs YAML frontmatter and a Markdown body`);
const name = frontmatter[1].match(/^name:\s*([^\s]+)\s*$/m)?.[1];
const description = frontmatter[1].match(/^description:\s*(.+)\s*$/m)?.[1];
assert(name === 'registry-broker', 'portable skill name must match its directory');
assert(
  /^(?!.*--)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name) &&
    name.length <= 64,
  'portable skill name violates Agent Skills constraints',
);
assert(
  typeof description === 'string' &&
    description.length > 20 &&
    description.length <= 1024,
  'portable skill needs a useful Agent Skills description',
);
assert(
  frontmatter[2].split('\n').length <= 500,
  'portable skill should stay within the Agent Skills progressive-disclosure limit',
);
for (const requiredText of [
  'HOL Universal Agentic Registry',
  'https://hol.org/.well-known/mcp',
  'https://hol.org/registry/api/v1/openapi.json',
  'Start read-only and public',
  'Never paste API keys',
]) {
  assert(skill.includes(requiredText), `${skillPath} is missing: ${requiredText}`);
}

assert(
  packageJson.description ===
    'Agent skills and CLI workflows for the HOL Universal Agentic Registry.',
  'package description must use the canonical HOL brand',
);
assert(packageJson.author === 'HOL <support@hol.org>', 'package author drifted');
for (const requiredFile of ['plugin.json', 'mcp.json', 'skills/']) {
  assert(packageJson.files.includes(requiredFile), `package files must include ${requiredFile}`);
}
assert(
  packageJson.scripts['validate:agent-plugin'] ===
    'node scripts/validate-agent-plugin.mjs',
  'package validation script drifted',
);

const workflow = readText('.github/workflows/validate-skill.yml');
for (const requiredText of [
  "'plugin.json'",
  "'mcp.json'",
  "'skills/**'",
  "'scripts/validate-agent-plugin.mjs'",
  'node scripts/validate-agent-plugin.mjs',
]) {
  assert(workflow.includes(requiredText), `validation workflow is missing ${requiredText}`);
}

console.log('Agent Plugin package is valid.');
