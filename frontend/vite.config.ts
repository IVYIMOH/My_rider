/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), VitePWA({
    strategies: 'generateSW',
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    manifest: {
      name: 'Sipi Rider — Ride with locals you trust',
      short_name: 'Sipi Rider',
      description: 'Sipi Rider connects travelers with verified taxi-association drivers who know the roads, the stories, and the shortcuts.',
      theme_color: '#149AA0',
      background_color: '#F6FAFB',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      icons: [{
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      }, {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }, {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      // OpenStreetMap tiles: cache-first so previously viewed areas still
      // render when the connection drops.
      runtimeCaching: [{
        urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'osm-tiles-cache',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 7
          }
        }
      }]
    },
    devOptions: {
      enabled: false
    }
  })],
  server: {
    port: 5173
  },
  test: {
    projects: [{
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});