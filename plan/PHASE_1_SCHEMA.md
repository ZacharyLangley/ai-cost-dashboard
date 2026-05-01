# Phase 1 — Database Schema

All tables, all indexes, all in one phase. Schema is the contract — get it right before pipelines depend on it.

## Files

Create one file per logical group under `src/db/schema/`:

- `raw.ts` — `raw_gh_usage`, `raw_m365_usage`
- `github.ts` — `gh_usage_facts`, `gh_seats`, `gh_metrics_daily`
- `m365.ts` — `m365_usage_facts`, `m365_app_activity`, `m365_interactions_weekly`
- `identity.ts` — `identity_map`
- `meta.ts` — `pipeline_runs`, `api_drift_log`
- `index.ts` — re-exports all

## Schema definitions

### raw.ts

```ts
export const rawGhUsage = sqliteTable('raw_gh_usage', {
  pullDate: text('pull_date').notNull(),
  billingMonth: text('billing_month').notNull(), // YYYY-MM
  payload: text('payload').notNull(), // JSON string
}, (t) => ({
  pk: primaryKey({ columns: [t.pullDate, t.billingMonth] }),
}));

export const rawM365Usage = sqliteTable('raw_m365_usage', {
  pullDate: text('pull_date').notNull(),
  pageIndex: integer('page_index').notNull(),
  payload: text('payload').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.pullDate, t.pageIndex] }),
}));
```

### github.ts

```ts
export const ghUsageFacts = sqliteTable('gh_usage_facts', {
  billingMonth: text('billing_month').notNull(),
  username: text('username').notNull(),
  product: text('product').notNull(),
  sku: text('sku').notNull(),
  model: text('model').notNull(),
  unitType: text('unit_type').notNull(),
  pricePerUnit: real('price_per_unit').notNull(),
  grossQty: integer('gross_qty').notNull(),
  grossAmount: real('gross_amount').notNull(),
  discountQty: integer('discount_qty').notNull(),
  discountAmount: real('discount_amount').notNull(),
  netQty: integer('net_qty').notNull(),
  netAmount: real('net_amount').notNull(),
  pulledAt: text('pulled_at').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.billingMonth, t.username, t.sku, t.model] }),
  byUser: index('gh_usage_by_user').on(t.username, t.billingMonth),
  byMonth: index('gh_usage_by_month').on(t.billingMonth),
}));

export const ghSeats = sqliteTable('gh_seats', {
  snapshotDate: text('snapshot_date').notNull(),
  username: text('username').notNull(),
  planType: text('plan_type').notNull(),
  seatCostUsd: real('seat_cost_usd').notNull(),
  lastActivityAt: text('last_activity_at'),
  assigneeTeam: text('assignee_team'),
}, (t) => ({
  pk: primaryKey({ columns: [t.snapshotDate, t.username] }),
}));

export const ghMetricsDaily = sqliteTable('gh_metrics_daily', {
  metricDate: text('metric_date').notNull(),
  username: text('username').notNull(),
  ide: text('ide').notNull(),
  feature: text('feature').notNull(), // 'completions' | 'chat'
  suggestions: integer('suggestions'),
  acceptances: integer('acceptances'),
}, (t) => ({
  pk: primaryKey({ columns: [t.metricDate, t.username, t.ide, t.feature] }),
}));
```

### m365.ts

```ts
export const m365UsageFacts = sqliteTable('m365_usage_facts', {
  pullDate: text('pull_date').notNull(),
  upn: text('upn').notNull(),
  upnIsHashed: integer('upn_is_hashed', { mode: 'boolean' }).notNull(),
  displayName: text('display_name'),
  lastActivity: text('last_activity'),
  daysSinceActive: integer('days_since_active'),
  seatSku: text('seat_sku').notNull(),
  seatCostUsd: real('seat_cost_usd').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.pullDate, t.upn] }),
}));

export const m365AppActivity = sqliteTable('m365_app_activity', {
  pullDate: text('pull_date').notNull(),
  upn: text('upn').notNull(),
  app: text('app').notNull(), // teams|word|excel|powerpoint|outlook|chat
  lastActive: text('last_active'),
}, (t) => ({
  pk: primaryKey({ columns: [t.pullDate, t.upn, t.app] }),
}));

export const m365InteractionsWeekly = sqliteTable('m365_interactions_weekly', {
  weekStarting: text('week_starting').notNull(),
  upn: text('upn').notNull(),
  appContext: text('app_context').notNull(),
  interactionCount: integer('interaction_count').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.weekStarting, t.upn, t.appContext] }),
}));
```

### identity.ts

```ts
export const identityMap = sqliteTable('identity_map', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ghUsername: text('gh_username').unique(),
  m365Upn: text('m365_upn').unique(),
  displayName: text('display_name').notNull(),
  team: text('team').notNull(),
  costCenter: text('cost_center'),
  startDate: text('start_date'),
  endDate: text('end_date'),
});
```

### meta.ts

```ts
export const pipelineRuns = sqliteTable('pipeline_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pipeline: text('pipeline').notNull(), // 'github' | 'm365' | 'm365_interactions' | 'derived'
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  status: text('status').notNull(), // 'running' | 'success' | 'failed'
  errorMessage: text('error_message'),
  rowsAffected: integer('rows_affected'),
});

export const apiDriftLog = sqliteTable('api_drift_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  detectedAt: text('detected_at').notNull(),
  source: text('source').notNull(),
  fieldPath: text('field_path').notNull(),
  unexpectedValue: text('unexpected_value'),
  payloadSample: text('payload_sample'),
});
```

## Migration

`src/db/migrate.ts` — runs Drizzle migrations against the SQLite file. Creates `./data/` if missing.

## DONE WHEN

- [ ] `npm run db:generate` produces SQL migration files in `./drizzle/`
- [ ] `npm run db:migrate` applies cleanly to fresh DB
- [ ] `sqlite3 data/copilot.db ".schema"` shows all 10 tables
- [ ] All primary keys and indexes present
- [ ] `tsc --noEmit` passes

Paste output of: `sqlite3 data/copilot.db ".tables"` and `sqlite3 data/copilot.db ".indexes"`
