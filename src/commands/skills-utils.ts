import { access, mkdir, writeFile } from 'node:fs/promises';
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

export async function initSkillPackage(params: {
  dir: string;
  name: string;
  version: string;
  description: string;
  force: boolean;
}): Promise<SkillsInitResult> {
  await mkdir(params.dir, { recursive: true });
  const skillJsonPath = path.join(params.dir, 'skill.json');
  const skillMdPath = path.join(params.dir, 'SKILL.md');
  const formatPath = path.join(params.dir, 'skill-format.md');

  const exists =
    (await fileExists(skillJsonPath)) ||
    (await fileExists(skillMdPath)) ||
    (await fileExists(formatPath));
  if (exists && !params.force) {
    throw new Error(
      `Refusing to overwrite existing files in ${params.dir}. Re-run with --force.`,
    );
  }

  const skillJson = {
    name: params.name,
    version: params.version,
    description: params.description,
    keywords: ['skills', 'registry-broker', 'hol'],
  };
  const skillMd = `# ${params.name}\n\n${params.description}\n\n## Capabilities\n\n- Describe what this skill enables.\n\n## Usage\n\n- Add concrete examples here.\n`;
  const formatMd = `# Skill Package\n\nThis directory contains a publishable skill package.\n\nRequired files:\n- SKILL.md\n- skill.json\n`;

  await writeFile(skillJsonPath, `${JSON.stringify(skillJson, null, 2)}\n`, 'utf8');
  await writeFile(skillMdPath, skillMd, 'utf8');
  await writeFile(formatPath, formatMd, 'utf8');

  return {
    dir: params.dir,
    name: params.name,
    version: params.version,
    created: ['skill.json', 'SKILL.md', 'skill-format.md'],
  };
}

