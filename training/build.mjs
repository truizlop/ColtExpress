import { build } from 'esbuild';
await build({
  entryPoints: ['training/bridge.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'training/bridge.mjs',
});
