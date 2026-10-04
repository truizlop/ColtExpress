import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import react from '@vitejs/plugin-react';
const modelVersion = createHash('sha256')
  .update(readFileSync(new URL('./public/models/champion.json', import.meta.url)))
  .digest('hex');
export default defineConfig({
  define: { 'import.meta.env.VITE_MODEL_VERSION': JSON.stringify(modelVersion) },
  plugins: [react()],
  base: './',
  build: { target: 'es2022' },
  server: { host: '127.0.0.1' },
});
