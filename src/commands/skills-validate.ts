import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { RegistryBrokerClient } from '@hol-org/rb-client';

import {
  collectSkillPackageFiles,
  DEFAULT_SKILL_MANIFEST_FILE,
  guessMimeType,
} from './skills-utils';
import {
  getManifestChecksum,
  isRecord,
  SHA256_PATTERN,
  validateSkillJson,
  validateSkillManifest,
  type JsonObject,
} from './skills-lint-rules';

type ParsedJsonFile = {
  value: JsonObject;
  raw: Buffer<ArrayBufferLike>;
};

const REQUIRED_ROOT_FILES = ['SKILL.md', 'skill.json'] as const;
const DISALLOWED_PATH_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)\.ds_store$/i,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /\.(exe|dll|so|dylib)$/i,
];

const readJsonObjectFile = async (
  filePath: string,
  label: string,
  addError: (message: string) => void,
): Promise<ParsedJsonFile | null> => {
  let raw: Buffer<ArrayBufferLike>;
  try {
    raw = await readFile(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addError(`Unable to read ${label}: ${message}`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addError(`${label} is not valid JSON: ${message}`);
    return null;
  }

  if (!isRecord(parsed)) {
    addError(`${label} must contain a JSON object.`);
    return null;
  }

  return { value: parsed, raw };
};

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
  const allowedMimeTypes =
    Array.isArray(config.allowedMimeTypes) && config.allowedMimeTypes.length > 0
      ? new Set(config.allowedMimeTypes)
      : null;

  const packageFiles = await collectSkillPackageFiles(dir, {
    includeHidden: true,
    includeSymlinks: true,
  });

  const visibleFiles = packageFiles.filter(file => !file.hidden && !file.symlink);
  const visibleFileNames = new Set(visibleFiles.map(file => file.relativePath));
  const fileCount = visibleFiles.length;
  const totalBytes = visibleFiles.reduce((sum, file) => sum + file.size, 0);

  const errors: string[] = [];
  const errorSet = new Set<string>();
  const addError = (message: string): void => {
    if (errorSet.has(message)) {
      return;
    }
    errorSet.add(message);
    errors.push(message);
  };

  const missingRequired = REQUIRED_ROOT_FILES.filter(fileName => !visibleFileNames.has(fileName));
  if (missingRequired.length > 0) {
    addError(`Missing required files: ${missingRequired.join(', ')}`);
  }

  for (const file of packageFiles) {
    if (file.symlink) {
      addError(`Symlinks are not allowed in skill packages: ${file.relativePath}`);
      continue;
    }
    if (file.hidden) {
      addError(`Hidden files are not allowed in skill packages: ${file.relativePath}`);
    }
    const lowerPath = file.relativePath.toLowerCase();
    for (const pattern of DISALLOWED_PATH_PATTERNS) {
      if (pattern.test(lowerPath)) {
        addError(`Disallowed file in skill package: ${file.relativePath}`);
        break;
      }
    }
  }

  if (typeof maxFiles === 'number' && fileCount > maxFiles) {
    addError(`Too many files: ${fileCount} (max ${maxFiles}).`);
  }
  if (typeof maxTotalSizeBytes === 'number' && totalBytes > maxTotalSizeBytes) {
    addError(`Total size too large: ${totalBytes} bytes (max ${maxTotalSizeBytes}).`);
  }

  if (allowedMimeTypes) {
    for (const file of visibleFiles) {
      const mimeType = guessMimeType(file.relativePath);
      if (!allowedMimeTypes.has(mimeType)) {
        addError(
          `File ${file.relativePath} has MIME type ${mimeType}, which is not allowed by broker config.`,
        );
      }
    }
  }

  const skillJson = visibleFileNames.has('skill.json')
    ? await readJsonObjectFile(path.join(dir, 'skill.json'), 'skill.json', addError)
    : null;
  const manifestFromSkillJson =
    skillJson &&
    typeof skillJson.value.manifest === 'string' &&
    skillJson.value.manifest.trim().length > 0
      ? skillJson.value.manifest.trim()
      : null;
  const manifestFromSkillJsonMissing =
    manifestFromSkillJson !== null && !visibleFileNames.has(manifestFromSkillJson);

  if (manifestFromSkillJsonMissing) {
    addError(`skill.json.manifest references missing file "${manifestFromSkillJson}".`);
  }

  const manifestFileName =
    manifestFromSkillJsonMissing
      ? null
      : ((manifestFromSkillJson && visibleFileNames.has(manifestFromSkillJson)
          ? manifestFromSkillJson
          : null) ??
        (visibleFileNames.has('SKILL.json')
          ? 'SKILL.json'
          : visibleFileNames.has(DEFAULT_SKILL_MANIFEST_FILE)
            ? DEFAULT_SKILL_MANIFEST_FILE
            : null));

  if (skillJson && !manifestFileName && !manifestFromSkillJsonMissing) {
    addError(
      `Missing manifest file. Add "SKILL.json" or "${DEFAULT_SKILL_MANIFEST_FILE}" and set skill.json.manifest.`,
    );
  }

  const skillManifest = manifestFileName
    ? await readJsonObjectFile(path.join(dir, manifestFileName), manifestFileName, addError)
    : null;

  const validatedSkillJson = skillJson ? validateSkillJson(skillJson.value, addError) : null;
  const validatedManifest = skillManifest
    ? validateSkillManifest(
        skillManifest.value,
        visibleFileNames,
        addError,
        manifestFileName ?? 'SKILL.json',
      )
    : null;

  if (validatedSkillJson && validatedManifest) {
    const manifestLabel = manifestFileName ?? 'SKILL.json';
    if (validatedSkillJson.name !== validatedManifest.name) {
      addError(`skill.json.name must match ${manifestLabel}.name.`);
    }
    if (validatedSkillJson.version !== validatedManifest.version) {
      addError(`skill.json.version must match ${manifestLabel}.version.`);
    }
    if (validatedSkillJson.description !== validatedManifest.description) {
      addError(`skill.json.description must match ${manifestLabel}.description.`);
    }
  }

  if (validatedManifest) {
    for (const file of visibleFiles) {
      if (manifestFileName && file.relativePath === manifestFileName) {
        continue;
      }
      if (!validatedManifest.files.has(file.relativePath)) {
        addError(`${manifestFileName ?? 'SKILL.json'}.files must include "${file.relativePath}".`);
      }
    }
  }

  if (skillJson && skillManifest) {
    const manifestChecksum = getManifestChecksum(skillJson.value);
    if (manifestChecksum) {
      if (!SHA256_PATTERN.test(manifestChecksum)) {
        addError('skill.json manifest checksum must be sha256:<64-hex> or <64-hex>.');
      } else {
        const expected = manifestChecksum.toLowerCase().replace(/^sha256:/, '');
        const actual = createHash('sha256').update(skillManifest.raw).digest('hex').toLowerCase();
        if (expected !== actual) {
          addError(
            `Manifest checksum mismatch: expected ${expected}, calculated ${actual} for ${manifestFileName ?? 'manifest file'}.`,
          );
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    dir,
    limits: { maxFiles, maxTotalSizeBytes },
    stats: { fileCount, totalBytes },
    errors,
  };
}
