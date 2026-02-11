#!/usr/bin/env node

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distCliUrl = pathToFileURL(path.join(__dirname, '..', 'dist', 'cli.js')).href;

try {
  const mod = await import(distCliUrl);
  if (typeof mod.main === 'function') {
    await mod.main();
  } else {
    throw new Error('dist/cli.js does not export main()');
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  console.error('Run `pnpm -C registry-broker-hashnet-openclaw build` and retry.');
  process.exit(1);
}
