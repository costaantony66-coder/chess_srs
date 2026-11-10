import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import pkg from './package.json' with { type: 'json' };

// VITE_BASE est fourni par la CI pour GitHub Pages (ex. "/chess-srs/").
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    {
      // Un identifiant de build dans le service worker : chaque déploiement renouvelle le cache.
      name: 'sw-build-id',
      apply: 'build',
      closeBundle() {
        const file = 'dist/sw.js';
        if (existsSync(file)) writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', String(Date.now())));
      },
    },
  ],
});
