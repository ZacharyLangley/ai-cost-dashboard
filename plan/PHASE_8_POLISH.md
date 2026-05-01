# Phase 8 — Hardening & Polish

Last phase. Operational concerns, alerting, docs.

## Tasks

### 1. Token expiry alerting

GitHub PAT and Azure client secret both expire. Pipeline must detect 401s and surface them visibly.

`src/lib/notify.ts`:
```ts
export async function notifyOps(message: string, severity: 'warn' | 'error'): Promise<void>
```

Implementations:
- Always: log to Pino at appropriate level
- Optional: webhook POST if `OPS_WEBHOOK_URL` env set (Slack-compatible JSON)

Pipeline failures invoke `notifyOps` with `severity: 'error'` and last 500 chars of error message. API drift entries invoke with `severity: 'warn'`.

### 2. Health check expansion

`/api/health` returns:
```json
{
  "ok": true,
  "ts": 1714694400000,
  "db": { "ok": true, "latencyMs": 2 },
  "redis": { "ok": true, "latencyMs": 1 },
  "lastPipelineRun": {
    "github": { "status": "success", "ago": "2h" },
    "m365": { "status": "success", "ago": "2h" }
  },
  "stalePipelines": []   // populated if any pipeline last-success > 36h ago
}
```

Returns 503 if any subsystem is `ok: false` or stale pipelines exist.

### 3. Backup script

`scripts/backup.sh` — copies `data/copilot.db` to `backups/copilot-YYYY-MM-DD.db` using SQLite `.backup` command (online, safe). Documented in README; user runs via cron on host.

### 4. README

Top-level `README.md` covering:
- What this is, who it's for
- Stack summary
- Setup: env vars, GitHub permissions, Azure app registration steps with screenshots-or-links
- First-run: backfill commands, identity CSV import
- Daily ops: where to check pipeline status
- Troubleshooting: common 401/403/404 causes
- Limits: hashed UPN behavior, June 1 transition, beta API risks

### 5. Bootstrap docs

`docs/SETUP_GITHUB.md` — step-by-step for GitHub credentials including which org settings to flip
`docs/SETUP_AZURE.md` — Azure app registration walkthrough, permissions, admin consent
`docs/CSV_FORMAT.md` — identity CSV schema with examples

### 6. Smoke test script

`scripts/smoke-test.ts` — runs after deploy:
- Hits `/api/health`, asserts 200
- Hits each top-level route, asserts 200 + non-empty
- Triggers each pipeline (admin endpoint), waits for completion, asserts success

### 7. Production build

- `npm run build` produces single deployable artifact
- Frontend served by Fastify static plugin
- Single command to run in prod: `node dist/api/index.js` (with worker as separate process: `node dist/jobs/worker.js`)
- Optional: `pm2.config.js` for process management

### 8. Performance check

With seeded data of 200 devs × 90 days:
- `/api/org/summary` — should respond <100ms
- `/api/developers` — <200ms
- Heatmap query — <300ms

If any exceed, add specific indexes or move to materialized derived table.

## DONE WHEN

- [ ] Health check returns expected payload
- [ ] Token expiry simulation (revoke PAT, run pipeline) → notification fires
- [ ] README walks new operator from zero to working dashboard
- [ ] Smoke test passes against fresh install + seeded data
- [ ] Production build runs from `dist/`, dashboard accessible on `:3000`
- [ ] All performance targets met or specific indexes added
- [ ] All TODO/FIXME comments resolved or moved to `OPEN_QUESTIONS.md`
