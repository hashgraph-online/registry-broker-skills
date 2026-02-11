import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { RegistryBrokerClient } from '@hol-org/rb-client';

export type SkillsValidateResult = {
  ok: boolean;
  dir: string;
  limits: { maxFiles: number | null; maxTotalSizeBytes: number | null };
  stats: { fileCount: number; totalBytes: number };
  errors: string[];
};

export async function validateSkillPackage(
  client: RegistryBrokerClient,
  dir: string,
): Promise<SkillsValidateResult> {
  const config = await client.skillsConfig();
  const maxFiles =
    typeof config.maxFiles === 'number' && Number.isFinite(config.maxFiles)
      ? config.maxFiles
      : null;
  const maxTotalSizeBytes =
    typeof config.maxTotalSizeBytes === 'number' &&
    Number.isFinite(config.maxTotalSizeBytes)
      ? config.maxTotalSizeBytes
      : null;

  const entries = await readdir(dir);
  const files = entries.filter(entry => !entry.startsWith('.'));
  const required = ['SKILL.md', 'skill.json'];
  const missing = required.filter(name => !files.includes(name));

  let totalBytes = 0;
  let fileCount = 0;
  for (const entry of files) {
    const fullPath = path.join(dir, entry);
    const st = await stat(fullPath);
    if (!st.isFile()) {
      continue;
    }
    fileCount += 1;
    totalBytes += st.size;
  }

  const errors: string[] = [];
  if (missing.length > 0) {
    errors.push(`Missing required files: ${missing.join(', ')}`);
  }
  if (typeof maxFiles === 'number' && fileCount > maxFiles) {
    errors.push(`Too many files: ${fileCount} (max ${maxFiles})`);
  }
  if (typeof maxTotalSizeBytes === 'number' && totalBytes > maxTotalSizeBytes) {
    errors.push(`Total size too large: ${totalBytes} bytes (max ${maxTotalSizeBytes})`);
  }

  return {
    ok: errors.length === 0,
    dir,
    limits: { maxFiles, maxTotalSizeBytes },
    stats: { fileCount, totalBytes },
    errors,
  };
}

