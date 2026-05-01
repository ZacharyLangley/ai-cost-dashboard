# Phase 0 — Scaffolding

Get the project skeleton running end-to-end before writing any business logic.

## Goals

- `npm run dev` starts API on :3000, worker process, and Vite on :5173
- SQLite DB file at `./data/copilot.db` initializes via Drizzle migrations
- Health check endpoint returns 200
- Frontend hits `/api/health` and renders the response

## Tasks

### 1. Init

```bash
npm init -y
npm i fastify @fastify/cors zod drizzle-orm better-sqlite3 ioredis bullmq node-cron pino dotenv
npm i -D typescript tsx @types/node @types/better-sqlite3 drizzle-kit prettier vitest @vitest/ui
```

Create `tsconfig.json` with strict mode, ES2022 target, NodeNext modules.

Create `.prettierrc` (semi: true, singleQuote: true, trailingComma: 'all', printWidth: 100).

### 2. Env config

`src/config/env.ts` — Zod-validated env. Required vars (placeholders OK for now):

```
DATABASE_URL=file:./data/copilot.db
REDIS_URL=redis://localhost:6379
GITHUB_TOKEN=
GITHUB_ORG=
GITHUB_ENTERPRISE=
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
GH_SEAT_COST_USD=19
M365_SEAT_COST_USD=30
PORT=3000
LOG_LEVEL=info
```

Parse fails fast on startup. Export typed `env` object.

### 3. Logger

`src/lib/logger.ts` — single Pino instance, child loggers per module.

### 4. Drizzle setup

`src/db/client.ts` — better-sqlite3 connection, drizzle wrapper, WAL mode enabled.

`drizzle.config.ts` at root pointing at `src/db/schema/*` for migrations to `./drizzle/`.

`src/db/schema/index.ts` — empty for now, just exports.

Add `npm run db:generate` and `npm run db:migrate` scripts.

### 5. Fastify server

`src/api/server.ts` — buildServer() factory returning Fastify instance. Registers CORS, error handler, `/api/health` route returning `{ ok: true, ts: Date.now() }`.

`src/api/index.ts` — entry point, calls buildServer().listen().

### 6. Worker stub

`src/jobs/worker.ts` — instantiates BullMQ Queue + Worker for `m365-interactions` queue. No processors yet, just connection + ready log.

### 7. Vite frontend

`web/` — Vite + React + TS + Tailwind. Single page that fetches `/api/health` and shows JSON. Vite dev server proxies `/api` → `http://localhost:3000`.

### 8. npm scripts

```json
{
  "dev": "concurrently -n api,worker,web -c blue,magenta,green \"npm:dev:api\" \"npm:dev:worker\" \"npm:dev:web\"",
  "dev:api": "tsx watch src/api/index.ts",
  "dev:worker": "tsx watch src/jobs/worker.ts",
  "dev:web": "cd web && vite",
  "build": "tsc && cd web && vite build",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx src/db/migrate.ts",
  "test": "vitest"
}
```

## DONE WHEN

- [ ] `npm run db:migrate` creates `./data/copilot.db` without error
- [ ] `npm run dev` starts all three processes, no errors in logs
- [ ] `curl localhost:3000/api/health` returns `{"ok":true,"ts":...}`
- [ ] Browser at `localhost:5173` shows the health response
- [ ] `npm test` runs (zero tests, but exits 0)
- [ ] `tsc --noEmit` passes with no errors

Paste output of: `curl -s localhost:3000/api/health && echo && tsc --noEmit && echo TYPES_OK`
