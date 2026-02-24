import path from 'node:path';

export type JsonObject = Record<string, unknown>;

export type ManifestShape = {
  name: string;
  version: string;
  description: string;
  files: Set<string>;
};

export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
export const SHA256_PATTERN = /^(?:sha256:)?[a-f0-9]{64}$/i;

const RAW_SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const COMMIT_PATTERN = /^[a-f0-9]{7,64}$/i;
const ALL_ZERO_COMMIT_PATTERN = /^0+$/;
const HRL_PATTERN = /^hcs:\/\/\d+\/\d+\.\d+\.\d+$/;

const toPosixPath = (value: string): string => value.split(path.sep).join('/');

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const getOptionalString = (value: unknown): string | null => {
  if (!isNonEmptyString(value)) {
    return null;
  }
  return value.trim();
};

const validateOasfTags = (
  tags: unknown,
  label: string,
  addError: (message: string) => void,
): number[] | null => {
  if (!Array.isArray(tags) || tags.length === 0) {
    addError(`${label}.tags must be a non-empty array of numeric OASF IDs.`);
    return null;
  }

  const normalized: number[] = [];
  for (const [index, tag] of tags.entries()) {
    if (typeof tag !== 'number' || !Number.isInteger(tag) || !Number.isFinite(tag)) {
      addError(`${label}.tags[${index}] must be an integer.`);
      continue;
    }
    if (tag < 100) {
      addError(`${label}.tags[${index}] must be >= 100 to align with OASF skill IDs.`);
      continue;
    }
    normalized.push(tag);
  }

  if (normalized.length !== tags.length) {
    return null;
  }

  const unique = new Set<number>();
  for (const tag of normalized) {
    if (unique.has(tag)) {
      addError(`${label}.tags contains duplicates; IDs must be unique.`);
      return null;
    }
    unique.add(tag);
  }

  const sorted = [...normalized].sort((a, b) => a - b);
  if (normalized.some((value, index) => value !== sorted[index])) {
    addError(`${label}.tags must be sorted in ascending numeric order.`);
    return null;
  }

  return normalized;
};

const validateMetadata = (
  metadata: JsonObject,
  label: string,
  addError: (message: string) => void,
): { name: string; description: string } | null => {
  const name = getOptionalString(metadata.name);
  if (!name) {
    addError(`${label}.name is required and must be a non-empty string.`);
  }

  const description = getOptionalString(metadata.description);
  if (!description) {
    addError(`${label}.description is required and must be a non-empty string.`);
  }

  const license = getOptionalString(metadata.license);
  if (!license) {
    addError(`${label}.license is required and must be a non-empty string.`);
  }

  const languages = metadata.languages;
  if (!Array.isArray(languages) || languages.length === 0) {
    addError(`${label}.languages must be a non-empty array of strings.`);
  } else if (!languages.every(isNonEmptyString)) {
    addError(`${label}.languages must only contain non-empty strings.`);
  }

  validateOasfTags(metadata.tags, label, addError);

  const homepage = getOptionalString(metadata.homepage);
  if (homepage && !isValidUrl(homepage)) {
    addError(`${label}.homepage must be a valid http(s) URL.`);
  }

  const repo = getOptionalString(metadata.repo);
  if (repo && !isValidUrl(repo)) {
    addError(`${label}.repo must be a valid http(s) URL.`);
  }

  const commit = getOptionalString(metadata.commit);
  if (commit && !COMMIT_PATTERN.test(commit)) {
    addError(`${label}.commit must be a hexadecimal commit hash (7-64 chars).`);
  } else if (commit && ALL_ZERO_COMMIT_PATTERN.test(commit)) {
    addError(`${label}.commit must not be all zeros.`);
  }

  if (!name || !description) {
    return null;
  }

  return { name, description };
};

export const validateSkillJson = (
  skillJson: JsonObject,
  addError: (message: string) => void,
): { name: string; version: string; description: string } | null => {
  const name = getOptionalString(skillJson.name);
  if (!name) {
    addError('skill.json.name is required and must be a non-empty string.');
  }

  const version = getOptionalString(skillJson.version);
  if (!version) {
    addError('skill.json.version is required and must be a non-empty string.');
  } else if (!SEMVER_PATTERN.test(version)) {
    addError('skill.json.version must be valid semver (for example 1.2.3).');
  }

  const description = getOptionalString(skillJson.description);
  if (!description) {
    addError('skill.json.description is required and must be a non-empty string.');
  }

  const metadataValue = skillJson.metadata;
  const metadata = isRecord(metadataValue) ? metadataValue : skillJson;
  if (metadataValue !== undefined && !isRecord(metadataValue)) {
    addError('skill.json.metadata must be a JSON object when provided.');
  }

  const validatedMetadata = validateMetadata(metadata, 'skill.json metadata', addError);
  if (validatedMetadata && name && validatedMetadata.name !== name) {
    addError('skill.json metadata.name must match skill.json.name.');
  }
  if (validatedMetadata && description && validatedMetadata.description !== description) {
    addError('skill.json metadata.description must match skill.json.description.');
  }

  if (!name || !version || !description) {
    return null;
  }
  return { name, version, description };
};

const validateManifestPath = (
  rawPath: string,
  label: string,
  addError: (message: string) => void,
): string | null => {
  const value = rawPath.trim();
  const posixPath = toPosixPath(value);
  const normalized = path.posix.normalize(posixPath);

  if (value.length === 0) {
    addError(`${label}.path must be non-empty.`);
    return null;
  }
  if (path.posix.isAbsolute(normalized)) {
    addError(`${label}.path must be relative, got "${value}".`);
    return null;
  }
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    addError(`${label}.path must not contain parent directory segments.`);
    return null;
  }
  if (normalized !== posixPath) {
    addError(`${label}.path must be normalized. Use "${normalized}".`);
    return null;
  }
  return normalized;
};

export const validateSkillManifest = (
  manifest: JsonObject,
  existingFiles: Set<string>,
  addError: (message: string) => void,
  manifestLabel = 'SKILL.json',
): ManifestShape | null => {
  const filesLabel = `${manifestLabel}.files`;
  const name = getOptionalString(manifest.name);
  if (!name) {
    addError(`${manifestLabel}.name is required and must be a non-empty string.`);
  }

  const description = getOptionalString(manifest.description);
  if (!description) {
    addError(`${manifestLabel}.description is required and must be a non-empty string.`);
  }

  const version = getOptionalString(manifest.version);
  if (!version) {
    addError(`${manifestLabel}.version is required and must be a non-empty string.`);
  } else if (!SEMVER_PATTERN.test(version)) {
    addError(`${manifestLabel}.version must be valid semver (for example 1.2.3).`);
  }

  const license = getOptionalString(manifest.license);
  if (!license) {
    addError(`${manifestLabel}.license is required and must be a non-empty string.`);
  }

  const author = manifest.author;
  if (!isNonEmptyString(author) && !isRecord(author)) {
    addError(`${manifestLabel}.author is required and must be a string or object.`);
  } else if (isRecord(author) && !isNonEmptyString(author.name)) {
    addError(`${manifestLabel}.author.name is required when author is an object.`);
  }

  const filesValue = manifest.files;
  if (!Array.isArray(filesValue) || filesValue.length === 0) {
    addError(`${filesLabel} must be a non-empty array.`);
    return null;
  }

  const manifestPaths = new Set<string>();
  for (const [index, fileValue] of filesValue.entries()) {
    const fileLabel = `${filesLabel}[${index}]`;
    if (!isRecord(fileValue)) {
      addError(`${fileLabel} must be an object.`);
      continue;
    }

    const rawPath = getOptionalString(fileValue.path);
    if (!rawPath) {
      addError(`${fileLabel}.path is required and must be a non-empty string.`);
      continue;
    }
    const normalizedPath = validateManifestPath(rawPath, fileLabel, addError);
    if (!normalizedPath) {
      continue;
    }
    if (manifestPaths.has(normalizedPath)) {
      addError(`${filesLabel} contains duplicate path "${normalizedPath}".`);
      continue;
    }
    manifestPaths.add(normalizedPath);

    if (!existingFiles.has(normalizedPath)) {
      addError(`${filesLabel} references missing file "${normalizedPath}".`);
    }

    const fileSha = getOptionalString(fileValue.sha256);
    if (fileSha && !RAW_SHA256_PATTERN.test(fileSha)) {
      addError(`${fileLabel}.sha256 must be 64 hexadecimal characters.`);
    }

    const fileHrl = getOptionalString(fileValue.hrl);
    if (fileHrl && !HRL_PATTERN.test(fileHrl)) {
      addError(`${fileLabel}.hrl must use format hcs://<protocol>/<topicId>.`);
    }

    const mime = fileValue.mime;
    if (mime !== undefined && !isNonEmptyString(mime)) {
      addError(`${fileLabel}.mime must be a non-empty string when provided.`);
    }
  }

  if (!manifestPaths.has('SKILL.md')) {
    addError(`${filesLabel} must include a root entry with path "SKILL.md".`);
  }

  if (!name || !version || !description) {
    return null;
  }

  return { name, version, description, files: manifestPaths };
};

export const getManifestChecksum = (skillJson: JsonObject): string | null => {
  const direct = getOptionalString(skillJson.manifest_checksum);
  if (direct) {
    return direct;
  }
  const camel = getOptionalString(skillJson.manifestChecksum);
  if (camel) {
    return camel;
  }

  const manifest = skillJson.manifest;
  if (isRecord(manifest)) {
    const nested = getOptionalString(manifest.checksum);
    if (nested) {
      return nested;
    }
  }
  return null;
};
