export function parseArgValue(args: string[], flag: string) {
  const idx = args.findIndex((arg) => arg === flag);
  if (idx === -1) {
    return { value: null as string | null, args };
  }
  const value = args[idx + 1];
  if (!value) {
    console.error(`Error: ${flag} requires a value.`);
    process.exit(1);
  }
  const filtered = args.filter((_, i) => i !== idx && i !== idx + 1);
  return { value: value.trim(), args: filtered };
}

export function parseRegisterOptions(argList: string[]) {
  let args = [...argList];
  const jsonMode = args.includes('--json');
  args = args.filter((a) => a !== '--json');

  const parsedName = parseArgValue(args, '--name');
  args = parsedName.args;
  const parsedDescription = parseArgValue(args, '--description');
  args = parsedDescription.args;
  const parsedEndpoint = parseArgValue(args, '--endpoint');
  args = parsedEndpoint.args;
  const parsedMetadata = parseArgValue(args, '--metadata-json');
  args = parsedMetadata.args;

  let metadata: Record<string, unknown> | null = null;
  if (typeof parsedMetadata.value === 'string') {
    try {
      metadata = JSON.parse(parsedMetadata.value) as Record<string, unknown>;
    } catch {
      console.error('Error: --metadata-json must be valid JSON.');
      process.exit(1);
    }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      console.error('Error: --metadata-json must be a JSON object.');
      process.exit(1);
    }
  }

  return {
    json: jsonMode,
    name: parsedName.value,
    description: parsedDescription.value,
    endpoint: parsedEndpoint.value,
    metadata,
    args,
  };
}

