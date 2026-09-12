import postgres from 'postgres'

/**
 * Database handle.
 *
 * Standard Postgres, so the same code runs against a container on your own
 * machine, a Postgres on a VPS, or a hosted provider. The only thing that
 * changes is DATABASE_URL.
 *
 * TLS is enabled whenever the URL asks for it (`sslmode=require`) or points
 * somewhere other than localhost, so a local docker-compose works without
 * certificates while a remote host is still encrypted.
 */

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error('DATABASE_URL not set')
}

const isLocal = /@(localhost|127\.0\.0\.1|db|postgres)[:/]/.test(url)
const wantsSsl = /sslmode=require|sslmode=verify/.test(url) || !isLocal

export const sql = postgres(url, {
  ssl: wantsSsl ? 'require' : false,
  // Serverless platforms create a process per request; a small pool avoids
  // exhausting connection limits. Raise it for a long-lived server.
  max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  idle_timeout: 20,
  connect_timeout: 10,
})
