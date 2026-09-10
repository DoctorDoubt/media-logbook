import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, execSync } from 'fs'
import { execSync as exec } from 'child_process'
import { readFileSync as rfs } from 'fs'

const pkg = JSON.parse(rfs('./package.json', 'utf-8'))

// Last 5 commits, skip auto "Bump version" commits
let changelog: string[] = []
try {
  changelog = exec('git log --pretty=format:"%s" -20', { encoding: 'utf-8' })
    .split('\n')
    .filter(l => l && !l.startsWith('Bump version'))
    .slice(0, 5)
} catch {}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_CHANGELOG__: JSON.stringify(changelog),
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
})
