# Phase 3 — M365 Pipeline

Same shape as GitHub: client → service → pipeline → idempotent persist.

## Module structure

```
src/services/m365/
  client.ts              # MS Graph HTTP client
  auth.ts                # MSAL client credentials flow
  usage.ts               # getMicrosoft365CopilotUsageUserDetail
  interactions.ts        # interactionHistory (beta)
  schemas.ts
  hashing.ts             # detect hashed UPNs

src/pipelines/m365/
  index.ts               # runM365Pipeline()
  ingest-usage.ts
  ingest-interactions.ts # invoked by BullMQ worker, not main pipeline
```

## Tasks

### 1. Auth (`auth.ts`)

- MSAL Node, client credentials flow
- Scope: `https://graph.microsoft.com/.default`
- Token cached in module-level variable until `exp - 60s`
- Single in-flight refresh promise to prevent thundering herd

### 2. Client (`client.ts`)

- Wraps fetch with auth header injection
- Generic pagination helper for `@odata.nextLink`:
  ```ts
  export async function* paginateGraph<T>(initialUrl: string): AsyncGenerator<T[]>
  ```
- 429 handling: respect `Retry-After` (Graph sends seconds, not date)
- 5xx exponential backoff, max 3 attempts

### 3. Hashing detection (`hashing.ts`)

```ts
// Hashed UPNs look like: random hex string, no @ sign, fixed length
// Real UPNs: user@tenant.onmicrosoft.com (or similar)
export function isHashedUpn(upn: string): boolean {
  return !upn.includes('@') || /^[a-f0-9]{32,}$/i.test(upn);
}
```

[SPECULATION] exact hash format may differ — verify against real tenant response, log first 5 examples to confirm pattern, then refine regex.

### 4. Usage service (`usage.ts`)

```ts
export async function* fetchUsageDetail(
  period: 'D7' | 'D30' | 'D90' | 'D180',
): AsyncGenerator<UsageDetailPage>
```

Pulls all pages. Caller writes each page to `raw_m365_usage` (PK = pull_date + page_index) before normalizing.

### 5. Pipeline (`pipelines/m365/index.ts`)

```ts
export async function runM365Pipeline() {
  const runId = await startPipelineRun('m365');
  try {
    let pageIndex = 0;
    for await (const page of fetchUsageDetail('D7')) {
      await persistRawPage(pullDate, pageIndex++, page);
      await normalizePage(pullDate, page);
    }
    await finishPipelineRun(runId, 'success');
  } catch (err) {
    await finishPipelineRun(runId, 'failed', err);
    throw err;
  }
}
```

Normalization:
- Detect `upnIsHashed` per row
- Extract per-app `lastActivityDate` fields → `m365_app_activity` rows (one per app per user)
- Map seat SKU from `assignedProductSkus` if present, else default to `M365_COPILOT` from env config

### 6. Interaction history (`interactions.ts`)

```ts
export async function fetchInteractionsForUser(
  upn: string,
  since: Date,
): Promise<InteractionRecord[]>
```

- Beta endpoint, expect schema instability — preserve raw response, normalize defensively
- Aggregate to `(week_starting, app_context, count)` rows

### 7. BullMQ job (`jobs/m365-interactions.ts`)

- Queue: `m365-interactions`
- Producer: weekly cron enqueues one job per active UPN (skip if `days_since_active > 7`)
- Worker: concurrency 4, calls `fetchInteractionsForUser`, upserts `m365_interactions_weekly`
- On 429: re-throw with `delay` based on `Retry-After`, BullMQ handles requeue

### 8. Manual trigger

`POST /api/admin/pipelines/m365/run` — runs usage pipeline synchronously
`POST /api/admin/pipelines/m365/interactions/enqueue` — fans out interaction jobs

## DONE WHEN

- [ ] `tsc --noEmit` passes
- [ ] `npm test` — M365 pipeline tests green (mocked)
- [ ] Tests cover: pagination, hashed UPN detection, app activity normalization, idempotency
- [ ] With real Azure creds: usage pipeline run completes, `m365_usage_facts` populated
- [ ] `m365_app_activity` has rows with one row per (user, app) where app activity exists
- [ ] Re-run is idempotent
- [ ] `pipeline_runs` shows successful run

If Azure creds unavailable: mock-only verification, document in `OPEN_QUESTIONS.md`.
