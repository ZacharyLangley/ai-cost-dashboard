# Phase 2 — GitHub Pipeline

Pull GitHub Copilot data, normalize, persist. Idempotent — re-running same day is a no-op on duplicates.

## Module structure

```
src/services/github/
  client.ts          # HTTP client, auth, rate-limit handling
  usage.ts           # /premium_request/usage
  seats.ts           # /copilot/billing/seats (paginated)
  metrics.ts         # /copilot/metrics + enterprise NDJSON
  schemas.ts         # Zod schemas for all responses
  types.ts           # Domain types

src/pipelines/github/
  index.ts           # runGitHubPipeline() orchestrator
  ingest-usage.ts    # raw → normalized
  ingest-seats.ts
  ingest-metrics.ts
```

## Tasks

### 1. HTTP client (`client.ts`)

- Uses native `fetch`
- Injects `Authorization: Bearer ${env.GITHUB_TOKEN}` and `X-GitHub-Api-Version: 2022-11-28`
- On 429 or secondary rate limit: read `X-RateLimit-Reset` or `Retry-After`, sleep, retry once
- On 5xx: exponential backoff, max 3 attempts
- On 404: throw typed `GitHubNotFoundError` — caller decides
- Returns parsed JSON
- All requests logged with method, path, status, duration

### 2. Zod schemas (`schemas.ts`)

Define for every endpoint response. The `unitType` field gets a `z.enum` with known values plus a passthrough — unknown values get logged to `api_drift_log` but don't crash.

```ts
export const usageItemSchema = z.object({
  product: z.string(),
  sku: z.string(),
  model: z.string(),
  unitType: z.string(), // not enum — log unknowns, don't reject
  pricePerUnit: z.number(),
  grossQuantity: z.number().int(),
  grossAmount: z.number(),
  discountQuantity: z.number().int(),
  discountAmount: z.number(),
  netQuantity: z.number().int(),
  netAmount: z.number(),
  // Per-user — endpoint returns username at top level of usageItem in some
  // shapes; verify against actual API response and adjust
  // [SPECULATION] structure may need adjustment on first real call
}).passthrough();
```

### 3. Usage service (`usage.ts`)

```ts
export async function fetchMonthlyUsage(
  org: string,
  year: number,
  month: number,
): Promise<RawUsageResponse>
```

- One call, no `user` filter — returns all users
- Caller (pipeline) handles persistence

### 4. Seats service (`seats.ts`)

- Paginate via `Link` header `rel="next"`
- Returns flat array of seats with `assignee.login`, `last_activity_at`, `plan_type`

### 5. Metrics service (`metrics.ts`)

- `fetchOrgMetrics(org)` — direct JSON
- `fetchEnterpriseUserReport(enterprise, days: 1 | 28)` — gets presigned URL, **immediately** fetches NDJSON, stream-parses line by line. Don't buffer the whole file. Use `node:readline` over the response body.

### 6. Pipeline orchestrator (`pipelines/github/index.ts`)

```ts
export async function runGitHubPipeline(): Promise<PipelineResult> {
  const runId = await startPipelineRun('github');
  try {
    await ingestUsage();   // current + previous month
    await ingestSeats();
    await ingestMetrics();
    await finishPipelineRun(runId, 'success');
  } catch (err) {
    await finishPipelineRun(runId, 'failed', err);
    throw err;
  }
}
```

Each ingest function:
1. Fetches from API
2. Writes raw payload to `raw_*` table (upsert on PK)
3. Normalizes into facts table (upsert on PK — idempotent)
4. Validates with Zod, logs drift to `api_drift_log` instead of throwing

### 7. Tests (`vitest`)

- Mock fetch with hand-crafted GitHub responses
- Test idempotency: run pipeline twice, assert row counts unchanged
- Test drift logging: feed unknown `unitType`, assert row in `api_drift_log` and ingest succeeded
- Test pagination: seats endpoint with multi-page Link header

## Manual trigger endpoint

`POST /api/admin/pipelines/github/run` — kicks off pipeline, returns run ID. Required for verification before scheduler exists.

## DONE WHEN

- [ ] `tsc --noEmit` passes
- [ ] `npm test` — all GitHub pipeline tests green
- [ ] With real `GITHUB_TOKEN` + `GITHUB_ORG`: `curl -X POST localhost:3000/api/admin/pipelines/github/run` completes without error
- [ ] `sqlite3 data/copilot.db "SELECT COUNT(*) FROM gh_usage_facts;"` returns > 0
- [ ] Re-running pipeline produces same counts (idempotent)
- [ ] `sqlite3 data/copilot.db "SELECT pipeline, status FROM pipeline_runs ORDER BY id DESC LIMIT 5;"` shows recent runs

If GitHub creds aren't available yet: build with mocks, mark verification gates "PENDING_REAL_API" in `OPEN_QUESTIONS.md` and proceed to Phase 3.
