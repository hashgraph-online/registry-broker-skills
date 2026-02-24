import { access, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const parseFlag = (
  args: string[],
  flag: string,
): { enabled: boolean; rest: string[] } => {
  const enabled = args.includes(flag);
  const rest = args.filter(entry => entry !== flag);
  return { enabled, rest };
};

export const parseOpt = (
  args: string[],
  flag: string,
): { value: string | null; rest: string[] } => {
  const idx = args.findIndex(entry => entry === flag);
  if (idx === -1) {
    return { value: null, rest: args };
  }
  const next = args[idx + 1];
  if (!next) {
    throw new Error(`Missing value for ${flag}`);
  }
  const rest = args.filter((_, i) => i !== idx && i !== idx + 1);
  return { value: next.trim(), rest };
};

export type SkillsInitResult = {
  dir: string;
  name: string;
  version: string;
  created: string[];
};

export type SkillPackageFile = {
  fullPath: string;
  relativePath: string;
  size: number;
  hidden: boolean;
  symlink: boolean;
};

export const HCS26_RECOMMENDED_DIRECTORIES = ['scripts', 'references', 'assets'] as const;
export const DEFAULT_SKILL_MANIFEST_FILE = 'SKILL.manifest.json';

const MIME_BY_EXTENSION = new Map<string, string>([
  ['.md', 'text/markdown'],
  ['.markdown', 'text/markdown'],
  ['.txt', 'text/plain'],
  ['.json', 'application/json'],
  ['.yaml', 'text/yaml'],
  ['.yml', 'text/yaml'],
  ['.csv', 'text/csv'],
  ['.html', 'text/html'],
  ['.xml', 'application/xml'],
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.cjs', 'text/javascript'],
  ['.ts', 'text/typescript'],
  ['.tsx', 'text/typescript'],
  ['.py', 'text/x-python'],
  ['.sh', 'text/x-shellscript'],
  ['.toml', 'application/toml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.pdf', 'application/pdf'],
]);

const toPosixPath = (value: string): string => value.split(path.sep).join('/');

const hasHiddenSegment = (relativePath: string): boolean =>
  relativePath.split('/').some(segment => segment.length > 0 && segment.startsWith('.'));

export const guessMimeType = (fileName: string): string => {
  const extension = path.extname(fileName.toLowerCase());
  return MIME_BY_EXTENSION.get(extension) ?? 'application/octet-stream';
};

export async function collectSkillPackageFiles(
  dir: string,
  options?: { includeHidden?: boolean; includeSymlinks?: boolean },
): Promise<SkillPackageFile[]> {
  const includeHidden = options?.includeHidden === true;
  const includeSymlinks = options?.includeSymlinks === true;
  const files: SkillPackageFile[] = [];

  const walk = async (currentDir: string): Promise<void> => {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = toPosixPath(path.relative(dir, fullPath));
      const hidden = hasHiddenSegment(relativePath);

      if (hidden && !includeHidden) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (entry.isSymbolicLink()) {
        if (!includeSymlinks) {
          continue;
        }
        files.push({
          fullPath,
          relativePath,
          size: 0,
          hidden,
          symlink: true,
        });
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileStat = await stat(fullPath);
      files.push({
        fullPath,
        relativePath,
        size: fileStat.size,
        hidden,
        symlink: false,
      });
    }
  };

  await walk(dir);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function initSkillPackage(params: {
  dir: string;
  name: string;
  version: string;
  description: string;
  force: boolean;
}): Promise<SkillsInitResult> {
  await mkdir(params.dir, { recursive: true });
  const skillJsonPath = path.join(params.dir, 'skill.json');
  const skillManifestPath = path.join(params.dir, DEFAULT_SKILL_MANIFEST_FILE);
  const skillMdPath = path.join(params.dir, 'SKILL.md');
  const formatPath = path.join(params.dir, 'skill-format.md');
  const scaffoldDirectories = HCS26_RECOMMENDED_DIRECTORIES.map(directory =>
    path.join(params.dir, directory),
  );

  const requiredPaths = [skillJsonPath, skillManifestPath, skillMdPath, formatPath, ...scaffoldDirectories];
  let exists = false;
  for (const requiredPath of requiredPaths) {
    if (await fileExists(requiredPath)) {
      exists = true;
      break;
    }
  }
  if (exists && !params.force) {
    throw new Error(
      `Refusing to overwrite existing files in ${params.dir}. Re-run with --force.`,
    );
  }

  const slug = params.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const homepage = `https://example.com/skills/${slug || 'my-skill'}`;
  const repo = 'https://github.com/your-org/your-skill-repo';
  const commit = '0000000000000000000000000000000000000000';

  const skillJson = {
    name: params.name,
    version: params.version,
    description: params.description,
    license: 'Apache-2.0',
    metadata: {
      name: params.name,
      description: params.description,
      license: 'Apache-2.0',
      languages: ['typescript'],
      tags: [1403],
      homepage,
      repo,
      commit,
    },
    manifest: DEFAULT_SKILL_MANIFEST_FILE,
    manifest_checksum: null,
    keywords: ['hcs-26', 'registry-broker', 'skills'],
  };

  const skillManifest = {
    name: params.name,
    description: params.description,
    version: params.version,
    license: 'Apache-2.0',
    author: 'Your Name or Organization',
    metadata: {
      name: params.name,
      description: params.description,
      license: 'Apache-2.0',
      languages: ['typescript'],
      tags: [1403],
      homepage,
      repo,
      commit,
    },
    files: [
      {
        path: 'SKILL.md',
        mime: 'text/markdown',
      },
      {
        path: 'skill.json',
        mime: 'application/json',
      },
      {
        path: 'skill-format.md',
        mime: 'text/markdown',
      },
    ],
  };

  const skillMd = `# ${params.name}

${params.description}

## Summary

- Name: ${params.name}
- Version: ${params.version}
- License: Apache-2.0

## Capabilities

- Add capability bullets here.

## Usage

1. Add usage instructions here.
2. Include runnable examples for each key workflow.
`;

  const formatMd = `# Skill Package

This directory contains an HCS-26 aligned skill package scaffold.

Required files:
- SKILL.md
- skill.json
- ${DEFAULT_SKILL_MANIFEST_FILE}

Recommended directories:
- scripts/
- references/
- assets/
`;

  await writeFile(skillJsonPath, `${JSON.stringify(skillJson, null, 2)}\n`, 'utf8');
  await writeFile(skillManifestPath, `${JSON.stringify(skillManifest, null, 2)}\n`, 'utf8');
  await writeFile(skillMdPath, skillMd, 'utf8');
  await writeFile(formatPath, formatMd, 'utf8');
  for (const directoryPath of scaffoldDirectories) {
    await mkdir(directoryPath, { recursive: true });
  }

  return {
    dir: params.dir,
    name: params.name,
    version: params.version,
    created: [
      'skill.json',
      DEFAULT_SKILL_MANIFEST_FILE,
      'SKILL.md',
      'skill-format.md',
      ...HCS26_RECOMMENDED_DIRECTORIES.map(directory => `${directory}/`),
    ],
  };
}
