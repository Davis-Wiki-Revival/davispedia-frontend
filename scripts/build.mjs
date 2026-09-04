import { resolve } from 'node:path';
import { build } from 'vite';

const watch = process.argv.includes('--watch') ? {} : null;

await build({
  configFile: resolve('vite.config.ts'),
  build: { watch },
});

await build({
  configFile: resolve('vite.cowlender.config.ts'),
  build: { watch },
});
