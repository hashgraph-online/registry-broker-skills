import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});

