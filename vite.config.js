import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served from a GitHub Pages project subpath in production
// (https://kenbolton.github.io/aca-skills-assessment/). Override with
// BASE_PATH="/" for root hosting (custom domain) or local dev at root.
const base = process.env.BASE_PATH || '/aca-skills-assessment/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'ACA Skills Assessment',
        short_name: 'ACA Assess',
        description: 'Offline coastal kayaking L1/L2 skills assessment',
        theme_color: '#005f6b',
        background_color: '#ffffff',
        display: 'standalone',
        scope: base,
        start_url: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,json,png,svg,woff2}'] },
    }),
  ],
  test: { environment: 'node' },
});
