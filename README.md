# AI Cost Dashboard

Local-first dashboard tracking GitHub Copilot (usage-based) and Microsoft 365 Copilot (seat-based) spend across developers and teams.

## What it does

- Per-developer and per-team cost breakdowns
- GitHub Copilot model mix, acceptance rate vs cost scatter
- M365 Copilot adoption heatmap and breadth scoring
- Idle seat detection (30-day threshold)
- Daily ingestion pipelines with idempotent upserts
- Admin UI for identity CSV import and manual pipeline triggers

## Stack

| Layer | Choice |
|---|---|
| Backend API | Fastify + TypeScript |
| Database | SQLite via Drizzle ORM |
| Scheduler | node-cron + BullMQ |
| Frontend | React + Vite + Tailwind + Recharts |
| Validation | Zod |
| Logging | Pino |

## Setup

### 1. Prerequisites

- Node.js 20+
- SQLite3 CLI (for backups)
- Redis (for BullMQ worker; `brew install redis && brew services start redis`)

### 2. Clone and install

```bash
git clone <repo>
cd ai-cost-dashboard
npm install
cd web && npm install && cd ..
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=file:./data/copilot.db
REDIS_URL=redis://localhost:6379

# GitHub — see docs/SETUP_GITHUB.md
GITHUB_TOKEN=ghp_...
GITHUB_ORG=your-org
GITHUB_ENTERPRISE=          # optional, for enterprise metrics

# Azure / M365 — see docs/SETUP_AZURE.md
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=

# Seat costs (USD/month)
GH_SEAT_COST_USD=19
M365_SEAT_COST_USD=30

# Optional: Slack-compatible webhook for pipeline failure alerts
OPS_WEBHOOK_URL=
```

### 4. Initialize database

```bash
npm run db:migrate
npm run db:seed        # optional: loads mock data for testing
```

### 5. Start development

```bash
npm run dev
```

Opens:
- API: `http://localhost:3000`
- Dashboard: `http://localhost:5173`

### 6. First run — identity import

GitHub usernames and M365 UPNs are separate namespaces. Map them via Admin → Identity → Import CSV.

Format: see `docs/CSV_FORMAT.md`

### 7. First run — backfill

Trigger pipelines from Admin → Pipelines → Run Now, or via curl:

```bash
curl -X POST localhost:3000/api/admin/pipelines/github/run
```

## Production

### Build

```bash
npm run build
```

Outputs compiled backend to `dist/` and frontend to `web/dist/`. The API serves `web/dist/` statically when `NODE_ENV=production`.

### Run

```bash
NODE_ENV=production node dist/api/index.js
NODE_ENV=production node dist/jobs/worker.js
```

Or with pm2:

```bash
pm2 start pm2.config.js
```

### Backup

```bash
./scripts/backup.sh
```

Copies `data/copilot.db` to `backups/copilot-YYYY-MM-DD.db`. Safe for live databases (WAL mode). Add to host cron:

```
0 3 * * * cd /path/to/ai-cost-dashboard && ./scripts/backup.sh >> logs/backup.log 2>&1
```

### Smoke test

```bash
tsx scripts/smoke-test.ts http://localhost:3000
```

## Daily operations

- Pipeline status: Admin → Pipelines (auto-refreshes every 10s)
- Health check: `GET /api/health` (returns 503 if DB down or pipelines stale >36h)
- API drift: Admin → Pipelines → API Drift Log

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| GitHub pipeline 401 | PAT expired or lacks `manage_billing:copilot` permission |
| GitHub pipeline 404 on `/premium_request/usage` | Org not on enhanced billing platform |
| GitHub pipeline 404 on enterprise metrics | `GITHUB_ENTERPRISE` not set or `read:enterprise` missing |
| M365 pipeline 401 | Azure client secret expired or admin consent not granted |
| M365 UPNs hashed | Privacy obfuscation enabled in M365 Admin Center (Reports → Privacy settings) |
| Team views empty | Identity CSV not imported — developers unmapped |
| `/api/health` returns 503 | Pipeline hasn't run successfully in >36h or DB unreachable |

## Limits

- **GitHub June 1 transition**: PRU → AI Credits. `unitType` field will shift. Dashboard renders a reference line on trend charts. Raw payloads preserved for re-derivation.
- **M365 hashed UPNs**: Per-user M365 views degrade to aggregate-only with a banner. Disable hashing for full visibility.
- **M365 interaction history API**: Beta/preview, per-user call. Disabled by default; expensive at scale.
- **Data lag**: GitHub metrics lag up to 2 UTC days. M365 report refresh date may lag 24h.
- **History**: GitHub billing data: 24 months. Metrics: 100 days. M365: configurable period (D7/D30/D90/D180).
