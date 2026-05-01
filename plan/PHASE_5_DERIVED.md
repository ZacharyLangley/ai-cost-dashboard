# Phase 5 — Derived Fields & Scheduling

Computed views, monthly rollups, and the cron schedule that ties everything together.

## Tasks

### 1. Derived computation pipeline

`src/pipelines/derived/index.ts` — runs after ingest pipelines complete each day.

Computations:

**a. Acceptance rate (per user, last 30d)**

```sql
SELECT username,
       SUM(suggestions) AS total_suggestions,
       SUM(acceptances) AS total_acceptances,
       CAST(SUM(acceptances) AS REAL) / NULLIF(SUM(suggestions), 0) AS acceptance_rate
FROM gh_metrics_daily
WHERE feature = 'completions'        -- scoped, not blended with chat
  AND metric_date >= date('now', '-30 days')
GROUP BY username;
```

Persist to `gh_acceptance_rates_30d` (new table — add to schema this phase).

**b. Idle status**

`gh_seats.last_activity_at < date('now', '-30 days')` → flag in derived table
Same for M365: `m365_usage_facts.days_since_active > 30`

**c. Days-since-active**

Compute on M365 ingest (already in pipeline), but recompute daily in case no fresh pull happened (stale data should still update relative dates).

**d. Team rollups (materialized)**

Two derived tables:

```sql
CREATE TABLE team_cost_monthly (
  billing_month     TEXT NOT NULL,
  team              TEXT NOT NULL,
  gh_seat_cost      REAL NOT NULL,
  gh_usage_cost     REAL NOT NULL,
  m365_seat_cost    REAL NOT NULL,
  active_devs       INTEGER NOT NULL,
  idle_seats        INTEGER NOT NULL,
  computed_at       TEXT NOT NULL,
  PRIMARY KEY (billing_month, team)
);

CREATE TABLE dev_cost_monthly (
  billing_month     TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  team              TEXT NOT NULL,
  gh_username       TEXT,
  m365_upn          TEXT,
  gh_seat_cost      REAL NOT NULL,
  gh_usage_cost     REAL NOT NULL,
  m365_seat_cost    REAL NOT NULL,
  total_cost        REAL NOT NULL,
  acceptance_rate   REAL,
  computed_at       TEXT NOT NULL,
  PRIMARY KEY (billing_month, display_name)
);
```

Add to `src/db/schema/derived.ts`. Wipe + repopulate each run (small data, simpler than incremental).

### 2. Monthly rollup job

First of each month, collapse prior month's daily snapshots:
- Keep one `gh_seats` row per user per month (last day of month)
- Keep one `m365_usage_facts` row per user per month
- Keep all `m365_app_activity` for the month, but delete daily after collapse
- Raw tables: delete > 90 days old

`src/jobs/monthly-rollup.ts` — pure SQL transactions, idempotent (uses `INSERT OR REPLACE` then `DELETE`).

### 3. Cron schedule

`src/jobs/scheduler.ts` — registered at worker startup:

```ts
// Daily ingest, 03:00 UTC
cron.schedule('0 3 * * *', async () => {
  await runGitHubPipeline();
  await runM365Pipeline();
  await runDerivedPipeline();
});

// Weekly M365 interaction fanout, Sunday 04:00 UTC
cron.schedule('0 4 * * 0', async () => {
  await enqueueM365InteractionJobs();
});

// Monthly rollup, 1st of month at 05:00 UTC
cron.schedule('0 5 1 * *', async () => {
  await runMonthlyRollup();
});
```

All jobs gated by `pipeline_runs` check — skip if already running.

### 4. Backfill scripts

`scripts/backfill-github.ts` — pull last 24 months of usage, last 100 days of metrics
`scripts/backfill-m365.ts` — pull `D180` once, normalize

Run via `tsx scripts/backfill-github.ts`. Idempotent.

### 5. Admin endpoints

```
POST /api/admin/pipelines/derived/run     # manual trigger
POST /api/admin/pipelines/rollup/run      # manual trigger
GET  /api/admin/pipelines/runs            # last 50 runs across all pipelines
```

## DONE WHEN

- [ ] Schema additions migrated cleanly
- [ ] Manual `derived/run` populates `team_cost_monthly` and `dev_cost_monthly`
- [ ] Re-running derived produces identical row counts (idempotent)
- [ ] Backfill scripts run without error against test data
- [ ] Cron schedule logged on worker startup
- [ ] `pipeline_runs` shows all four pipelines have run successfully
- [ ] `npm test` covers: rollup math, idle flagging, acceptance rate calc with edge cases (zero suggestions, null acceptances)
