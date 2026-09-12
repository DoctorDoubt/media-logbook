# MediaLog

A media logbook — track movies, TV, games and comics across a **backlog** (what you're working
through) and a **futurelog** (what isn't out yet). Runs in the browser, as an installable PWA, or
as a native desktop app.

> **Single user by design.** There are no accounts, roles or registration. Server mode is
> protected by one shared password: anyone who has it sees and edits everything. It's built for
> one person's library, or a household that trusts each other — not as a multi-tenant service.
> Read [Security](#security) before putting it on the public internet.

## Where your data lives — pick one

Chosen at runtime in Settings, not at build time. You can switch whenever, and export/import
moves entries between modes.

| Mode | Stored in | Needs | Syncs across devices |
|---|---|---|---|
| **Server** | Postgres, via the bundled API | a machine to run it on | yes |
| **This device** | SQLite inside the desktop app | nothing | no |
| **This browser** | `localStorage` | nothing | no |

If you only use one machine, pick one of the bottom two and skip all configuration — there is no
server to run and no password to set. Choose **Server** when you want the same list on your
phone and your laptop.

## Quick start

### Browser or desktop only — no server

```bash
npm install
npm run dev:vite     # browser, http://localhost:5173
npm run dev          # desktop app (Tauri)
```

Open Settings and pick *This browser* or *This device*. That's the whole setup.

### Server mode with Docker

```bash
cp .env.example .env     # set SITE_PASSWORD and the two JWT secrets
docker compose up -d
```

http://localhost:3000. The schema is created automatically on first boot.

Generate each secret with:

```bash
openssl rand -base64 48
```

### Server mode without Docker

Point `DATABASE_URL` at any Postgres, then:

```bash
npm install
cp .env.example .env.local     # fill it in
npm run migrate                # create the schema (idempotent)
npm run build:frontend
npm run serve                  # http://localhost:3000
```

## Making it yours

Rename the app in one place — `src/config.ts`:

```ts
export const APP_NAME = 'MediaLog'
export const STORAGE_PREFIX = 'medialog'
```

`APP_NAME` covers the window title, the password prompt and export filenames. `STORAGE_PREFIX`
namespaces every browser storage key. If you rename after people already have data, add the old
prefix to `LEGACY_STORAGE_PREFIXES` in the same file and it carries over on next load.

Two spots don't read that file and need editing by hand: the theme bootstrap at the top of
`index.html` (it runs before the bundle loads) and `productName` / `identifier` in
`src-tauri/tauri.conf.json`. **Changing the Tauri `identifier` changes where the desktop database
lives**, so an existing install will look empty — export first, or move `data.db` yourself.

## Development

```bash
npm run dev:vite       # frontend only — browser and desktop modes work, server mode won't
npm run serve          # API + built frontend on :3000
npm test               # vitest
npm run build:frontend # typecheck + production bundle
npm run build          # desktop app bundle
```

`npm run dev:vite` serves the UI with nothing behind `/api`, so **server mode can't log in** under
it. Use `npm run serve` (or Docker) when you're working on anything server-backed.

## Deployment

`docker compose up -d` is the supported path. For a public domain with automatic HTTPS, set
`DOMAIN` in `.env` and uncomment the `caddy` service in `docker-compose.yml` — then change the
app's port mapping to `127.0.0.1:3000:3000` so only Caddy is exposed.

The API handlers in `api/` are plain functions over the standard `Request`/`Response`, so they
also run unmodified as serverless functions on platforms that use the same convention —
`vercel.json` is included for that. Both targets execute identical request code.

## How it fits together

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind, TypeScript |
| Desktop | Tauri 2 (Rust), SQLite via `rusqlite` |
| API | Plain `Request`/`Response` handlers in `api/`, routed by Hono in `server/` |
| Database | Postgres |
| Auth | One site password → short-lived JWT (`jose`) |

`src/lib/backend.ts` is the seam: the app talks to it instead of any particular store, and it
dispatches to the API, to Tauri's SQLite commands, or to `localStorage` depending on the selected
mode. Adding a backend means implementing that interface.

`migrate-db.ts` is both the schema definition and the migration runner. It's idempotent and
applies additive changes on re-run.

## Security

- **One shared password.** No accounts, no roles. Treat it like a door key.
- Login is rate limited per IP, and the limiter needs the `rate_limits` table — created by
  `migrate-db.ts`. If that migration hasn't run, **the limiter fails open**.
- Tokens are short-lived JWTs in `sessionStorage`; refresh tokens are stored server-side and can
  be revoked by deleting rows from `refresh_tokens`.
- Security headers are set in `server/index.ts` (and mirrored in `vercel.json`). If you terminate
  TLS at your own proxy you may prefer to set them there — just don't drop them from both.
- Never commit your filled-in `.env`. `.gitignore` excludes every `.env*` except `.env.example`.
- The desktop and browser modes involve no network and no password at all.

## License

MIT — see [LICENSE](LICENSE).
