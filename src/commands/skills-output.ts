import pc from 'picocolors';

type SkillListItem = {
  name?: string | null;
  version?: string | null;
  description?: string | null;
  createdAt?: string | null;
  verified?: boolean | null;
  featured?: boolean | null;
  skillUid?: number | null;
  directoryTopicId?: string | null;
  manifestHrl?: string | null;
  skillJsonHrl?: string | null;
  files?: Array<{ name?: string | null; hrl?: string | null }> | null;
};

export type SkillsListResponseLike = {
  items: SkillListItem[];
  nextCursor?: string | null;
};

export type SkillsMineItemLike = {
  name?: string | null;
  latestVersion?: string | null;
  latestCreatedAt?: string | null;
  verified?: boolean | null;
  versions?: string[] | null;
};

export type SkillsMineResponseLike = {
  items: SkillsMineItemLike[];
};

export type SkillsMyListResponseLike = {
  owned: SkillsMineResponseLike;
  upvoted: SkillsListResponseLike;
};

export type SkillsConfigLike = {
  enabled?: boolean | null;
  network?: string | null;
  directoryTopicId?: string | null;
  maxFiles?: number | null;
  maxTotalSizeBytes?: number | null;
  allowedMimeTypes?: string[] | null;
};

const truncate = (value: string, max: number): string => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
};

const padRight = (value: string, width: number): string => {
  if (value.length >= width) {
    return value;
  }
  return `${value}${' '.repeat(width - value.length)}`;
};

const formatBool = (value: boolean | null | undefined): string => {
  if (value === true) {
    return pc.green('yes');
  }
  if (value === false) {
    return pc.dim('no');
  }
  return pc.dim('-');
};

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) {
    return pc.dim('-');
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return pc.dim('-');
  }
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}Z`;
};

export function printSkillsConfig(config: SkillsConfigLike): void {
  const enabled = config.enabled === true ? pc.green('enabled') : pc.red('disabled');
  console.log(`${pc.bold('Skill Registry')}: ${enabled}`);
  if (config.network) {
    console.log(`${pc.bold('Network')}: ${config.network}`);
  }
  if (config.directoryTopicId) {
    console.log(`${pc.bold('Directory Topic')}: ${config.directoryTopicId}`);
  }
  if (typeof config.maxFiles === 'number') {
    console.log(`${pc.bold('Max Files')}: ${config.maxFiles}`);
  }
  if (typeof config.maxTotalSizeBytes === 'number') {
    console.log(`${pc.bold('Max Package Size')}: ${config.maxTotalSizeBytes} bytes`);
  }
  if (Array.isArray(config.allowedMimeTypes) && config.allowedMimeTypes.length > 0) {
    console.log(`${pc.bold('Allowed MIME Types')}: ${config.allowedMimeTypes.join(', ')}`);
  }
}

export function printSkillItem(item: SkillListItem | null): void {
  if (!item) {
    console.log(pc.dim('No matching skill found.'));
    return;
  }
  const name = item.name ?? pc.dim('(unknown)');
  const version = item.version ?? pc.dim('(unknown)');
  console.log(`${pc.bold(name)} ${pc.dim(version)}`);
  if (item.description) {
    console.log(item.description);
  }
  const metaParts: string[] = [];
  if (typeof item.skillUid === 'number') {
    metaParts.push(`uid=${item.skillUid}`);
  }
  metaParts.push(`verified=${item.verified === true ? 'yes' : 'no'}`);
  if (item.createdAt) {
    metaParts.push(`created=${formatDate(item.createdAt)}`);
  }
  console.log(pc.dim(metaParts.join('  ')));
  if (item.manifestHrl) {
    console.log(`${pc.bold('manifest')}: ${item.manifestHrl}`);
  }
  if (item.skillJsonHrl) {
    console.log(`${pc.bold('skill.json')}: ${item.skillJsonHrl}`);
  }
  if (Array.isArray(item.files) && item.files.length > 0) {
    console.log(pc.bold('files:'));
    for (const file of item.files) {
      const fileName = file.name ?? '(unknown)';
      const hrl = file.hrl ?? '';
      console.log(`- ${fileName}${hrl ? `  ${pc.dim(hrl)}` : ''}`);
    }
  }
}

export function printSkillList(data: SkillsListResponseLike): void {
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    console.log(pc.dim('No skills found.'));
    return;
  }

  const rows = items.map((item) => {
    const name = item.name ?? '';
    const version = item.version ?? '';
    const uid = typeof item.skillUid === 'number' ? String(item.skillUid) : '';
    const verified = item.verified === true ? 'yes' : 'no';
    const created = formatDate(item.createdAt);
    return { name, version, uid, verified, created };
  });

  const nameWidth = Math.min(
    42,
    Math.max('NAME'.length, ...rows.map(r => r.name.length)),
  );
  const versionWidth = Math.min(
    28,
    Math.max('VERSION'.length, ...rows.map(r => r.version.length)),
  );
  const uidWidth = Math.max('UID'.length, ...rows.map(r => r.uid.length));

  console.log(pc.bold(`Skills (${items.length})`));
  console.log(
    `${padRight('NAME', nameWidth)}  ${padRight('VERSION', versionWidth)}  ${padRight('UID', uidWidth)}  VERIFIED  CREATED`,
  );
  console.log(
    `${pc.dim('-'.repeat(nameWidth))}  ${pc.dim('-'.repeat(versionWidth))}  ${pc.dim('-'.repeat(uidWidth))}  ${pc.dim('-------')}  ${pc.dim('------')}`,
  );

  for (const row of rows) {
    const name = truncate(row.name, nameWidth);
    const version = truncate(row.version, versionWidth);
    const verified = row.verified === 'yes' ? pc.green('yes') : pc.dim('no');
    console.log(
      `${padRight(name, nameWidth)}  ${padRight(version, versionWidth)}  ${padRight(row.uid || '-', uidWidth)}  ${padRight(verified, 7)}  ${row.created}`,
    );
  }

  const nextCursor = data.nextCursor ?? null;
  console.log('');
  console.log(`${pc.bold('Next cursor')}: ${nextCursor ? nextCursor : pc.dim('<none>')}`);
}

function printOwnedSkillsTable(data: SkillsMineResponseLike): void {
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    console.log(pc.dim('No owned skills found.'));
    return;
  }

  const rows = items.map((item) => {
    const name = item.name ?? '';
    const latestVersion = item.latestVersion ?? '';
    const verified = item.verified === true;
    const latestCreatedAt = formatDate(item.latestCreatedAt);
    const versions = Array.isArray(item.versions) ? item.versions : [];
    return { name, latestVersion, verified, latestCreatedAt, versions };
  });

  const nameWidth = Math.min(42, Math.max('NAME'.length, ...rows.map(r => r.name.length)));
  const versionWidth = Math.min(
    28,
    Math.max('LATEST'.length, ...rows.map(r => r.latestVersion.length)),
  );

  console.log(pc.bold(`Owned skills (${rows.length})`));
  console.log(
    `${padRight('NAME', nameWidth)}  ${padRight('LATEST', versionWidth)}  VERIFIED  UPDATED`,
  );
  console.log(
    `${pc.dim('-'.repeat(nameWidth))}  ${pc.dim('-'.repeat(versionWidth))}  ${pc.dim('-------')}  ${pc.dim('------')}`,
  );

  for (const row of rows) {
    const name = truncate(row.name, nameWidth);
    const latest = truncate(row.latestVersion, versionWidth);
    const verified = row.verified ? pc.green('yes') : pc.dim('no');
    console.log(
      `${padRight(name, nameWidth)}  ${padRight(latest, versionWidth)}  ${padRight(verified, 7)}  ${row.latestCreatedAt}`,
    );
  }
}

export function printMySkillsList(data: SkillsMyListResponseLike): void {
  console.log(pc.bold('My Skills List'));
  console.log('');
  printOwnedSkillsTable(data.owned);
  console.log('');
  console.log(pc.bold('Upvoted skills'));
  printSkillList(data.upvoted);
}

export function printSkillsInitResult(result: {
  dir: string;
  name: string;
  version: string;
  created: string[];
}): void {
  console.log(`${pc.bold('Initialized skill package')}: ${result.name} ${pc.dim(result.version)}`);
  console.log(`${pc.bold('dir')}: ${result.dir}`);
  console.log(`${pc.bold('created')}: ${result.created.join(', ')}`);
  console.log(pc.dim('Next: edit SKILL.md, then run `skills validate` and `skills publish`.'));
}

export function printSkillsValidateResult(result: {
  ok: boolean;
  dir: string;
  limits: { maxFiles: number | null; maxTotalSizeBytes: number | null };
  stats: { fileCount: number; totalBytes: number };
  errors: string[];
}): void {
  const status = result.ok ? pc.green('PASS') : pc.red('FAIL');
  console.log(`${pc.bold('Skill package validation')}: ${status}`);
  console.log(`${pc.bold('dir')}: ${result.dir}`);
  console.log(
    `${pc.bold('files')}: ${result.stats.fileCount}  ${pc.bold('size')}: ${result.stats.totalBytes} bytes`,
  );
  const maxFiles = result.limits.maxFiles ?? null;
  const maxBytes = result.limits.maxTotalSizeBytes ?? null;
  console.log(
    `${pc.bold('limits')}: files=${maxFiles ?? pc.dim('-')}  bytes=${maxBytes ?? pc.dim('-')}`,
  );
  if (!result.ok) {
    console.log(pc.bold('errors:'));
    for (const e of result.errors) {
      console.log(`- ${e}`);
    }
  }
}
