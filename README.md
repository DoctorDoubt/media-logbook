# jefflog

A personal media logbook — track movies, TV, games, and comics across a **backlog** (things you're
working through) and a **futurelog** (things not out yet). Runs as a web app and as a native
desktop app, backed by a shared Postgres database so both stay in sync.

## Features

- Four media types (`movie`, `tv`, `game`, `comic`) with per-entry status: planned, in progress,
  completed, paused, dropped, replaying
- Backlog and futurelog as separate lists, with drag-and-drop reordering
- Calendar and timeline views for completion dates and upcoming releases
- Cover art lookup
- Offline-tolerant local storage with background sync
- Installable as a PWA, or run as a Tauri desktop app

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, TypeScript |
| Desktop | Tauri 2 (Rust) |
| API | Vercel serverless functions (`api/`) |
| Database | Neon serverless Postgres |
| Auth | Single site password → short-lived JWT (`jose`) |

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in real values
```

You'll need a [Neon](https://neon.tech) database. Put its pooled connection string in
`DATABASE_URL`, pick a `SITE_PASSWORD`, and generate the two JWT secrets:

```bash
openssl rand -base64 48
```

Then create the schema:

```bash
npx tsx migrate-db.ts
```

`migrate-db.ts` is idempotent and doubles as the schema definition — it creates `users`,
`media_entries`, and `refresh_tokens`, and applies additive migrations on re-run.

## Running it

> **Important:** `src/lib/api.ts` calls the API at the relative path `/api`, and `vite.config.ts`
> defines no proxy. Plain `vite` therefore serves the UI with **nothing behind `/api`** — every
> request 404s and you cannot log in. Use `vercel dev`, which serves the `api/` functions locally
> and loads `.env.local`.

```bash
vercel dev          # full stack — UI + API, this is the one you usually want
npm run dev         # Tauri desktop app (expects a backend on :5173, see note above)
npm run dev:vite    # UI only, no API
npm run test        # vitest
npm run build:frontend
npm run build       # Tauri production bundle
```

## Deployment

Deployed on Vercel. `vercel.json` builds the frontend to `dist/` and serves `api/` as functions.
Set every variable from `.env.example` in the project's environment variables. `DATABASE_URL`,
`JWT_SECRET`, and `JWT_REFRESH_SECRET` are required — the functions throw on boot without them.
The cover-art keys (`TMDB_API_KEY`, `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`) are optional; each
provider simply returns no covers when unconfigured.

## Security notes

This is a single-user app. Access is one shared site password compared against `SITE_PASSWORD`,
which is exchanged for a JWT. There are no user accounts, roles, or registration flow — don't
deploy it as multi-tenant. Never commit `.env.local`; `.gitignore` excludes all `.env.*` files
except `.env.example`.

## License

MIT — see [LICENSE](LICENSE).
