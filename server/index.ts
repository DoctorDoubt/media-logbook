/**
 * Self-hosted server.
 *
 * The handlers in `api/` are plain functions over the web-standard Request and
 * Response, which is also what Vercel's file-based functions expect. This file
 * adds nothing but routing and static file serving, so both deployment targets
 * run exactly the same request code — there is no second implementation to
 * keep in step.
 *
 *   npm run build:frontend && npm run serve
 */
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

import { POST as checkPassword } from '../api/check-password.js'
import { GET as getCover } from '../api/cover.js'
import { GET as getEntries } from '../api/entries/index.js'
import { POST as createEntry } from '../api/entries/create.js'
import { POST as updateEntry } from '../api/entries/update.js'
import { POST as deleteEntry } from '../api/entries/delete.js'
import { GET as syncEntries } from '../api/entries/sync.js'
import { POST as importEntries } from '../api/entries/import.js'

const app = new Hono()

/**
 * Security headers.
 *
 * These were previously declared in vercel.json, which only applies on Vercel.
 * Keeping them here means a self-hosted deployment is not quietly less
 * protected than the hosted one. If you terminate TLS at a reverse proxy you
 * may prefer to set them there instead — just don't set them in neither place.
 */
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (c.req.path.startsWith('/api/')) {
    c.header(
      'Content-Security-Policy',
      "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline';"
    )
  }
})

// Cheap liveness probe for compose healthchecks and uptime monitors.
app.get('/api/health', (c) => c.json({ ok: true }))

app.post('/api/check-password', (c) => checkPassword(c.req.raw))
app.get('/api/cover', (c) => getCover(c.req.raw))
app.get('/api/entries', (c) => getEntries(c.req.raw))
app.get('/api/entries/sync', (c) => syncEntries(c.req.raw))
app.post('/api/entries/create', (c) => createEntry(c.req.raw))
app.post('/api/entries/update', (c) => updateEntry(c.req.raw))
app.post('/api/entries/delete', (c) => deleteEntry(c.req.raw))
app.post('/api/entries/import', (c) => importEntries(c.req.raw))

// Anything else that looks like an API call is a 404, not the SPA shell —
// otherwise a typo'd endpoint returns index.html and fails confusingly.
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404))

// Built frontend.
app.use('/*', serveStatic({ root: './dist' }))

// SPA fallback: client-side routes resolve to the shell.
app.get('*', serveStatic({ path: './dist/index.html' }))

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`MediaLog listening on http://localhost:${info.port}`)
})
