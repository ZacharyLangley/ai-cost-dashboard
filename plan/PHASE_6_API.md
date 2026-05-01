# Phase 6 — Read API

Fastify routes for the dashboard. All responses Zod-validated. No business logic in route handlers — delegate to services.

## Module structure

```
src/api/
  routes/
    health.ts              # already exists
    admin.ts               # already exists (pipeline triggers)
    developers.ts          # per-developer views
    teams.ts               # per-team views
    org.ts                 # org-wide views
    products.ts            # GH-only and M365-only views
  schemas/
    common.ts              # shared types (DateRange, etc.)
    developers.ts
    teams.ts
    org.ts
  server.ts                # register all route plugins
```

## Endpoints

### Developers

```
GET /api/developers
  ?month=YYYY-MM            # default: current
  ?team=string              # optional filter
  ?sort=cost|name|acceptance # default: cost desc
Returns: DeveloperSummary[] from dev_cost_monthly + identity_map join

GET /api/developers/:displayName
  ?months=6                 # default 6
Returns: {
  identity: IdentityRow,
  monthly: MonthlyTrend[],   # cost over time, segmented at June 1
  modelMix: ModelBreakdown[], # GH usage by model
  acceptanceRate: number | null,
  m365Apps: AppActivity[],
  idle: { github: bool, m365: bool, daysIdle: number }
}
```

### Teams

```
GET /api/teams
  ?month=YYYY-MM
Returns: TeamSummary[] from team_cost_monthly

GET /api/teams/:teamName
  ?months=6
Returns: {
  monthly: TeamTrend[],
  developers: DeveloperSummary[],
  budgetBurn: { mtdSpend, projectedEom, allotment | null },
  topModels: ModelBreakdown[]
}
```

### Org

```
GET /api/org/summary
Returns: {
  totalCostMonth: number,
  breakdown: { ghSeats, ghUsage, m365Seats },
  activeDevs: number,
  idleSeats: { github, m365 },
  unmappedCount: number
}

GET /api/org/idle-seats
  ?product=github|m365
Returns: IdleSeat[] sorted by wasted_cost desc

GET /api/org/trend
  ?months=12
  ?groupBy=product|team|model
Returns: TimeSeries[]
```

### Products

```
GET /api/products/github/models
  ?month=YYYY-MM
Returns: { model, totalCost, totalQty, userCount }[]

GET /api/products/github/acceptance-vs-cost
Returns: { username, displayName, team, acceptanceRate, completionsCost }[]
  # Note: cost is COMPLETIONS-scoped, not blended with PRU. Document in response.

GET /api/products/m365/adoption-heatmap
Returns: { upn, displayName, team, apps: { teams, word, excel, ppt, outlook, chat } }[]
  # Each app value is days_since_active or null

GET /api/products/m365/breadth
Returns: { displayName, team, appCount, apps: string[] }[]
```

### Meta

```
GET /api/meta/pipeline-status
Returns: { pipeline, lastRun, status, nextScheduled }[]

GET /api/meta/api-drift
  ?since=ISO_DATE
Returns: ApiDriftEntry[]

GET /api/meta/hashing-status
Returns: { m365UpnHashed: bool, lastDetectedAt: string }
```

## Service layer

Each route delegates to a service in `src/services/queries/`:

```
src/services/queries/
  developers.ts
  teams.ts
  org.ts
  products.ts
  meta.ts
```

Service functions return domain types. Routes handle HTTP concerns (status codes, Zod validation).

## Cross-cutting

### Error handling

Custom error classes in `src/lib/errors.ts`:
- `NotFoundError` → 404
- `ValidationError` → 400
- `ExternalApiError` → 502
- Unknown → 500 with sanitized message

Fastify error handler maps these.

### Response validation

Every route declares response schema. In dev, validate outgoing responses (catches drift early). In prod, skip for performance.

### Pagination

Cursor-based for any endpoint that could return >500 rows. Default page size 100.

### CORS

Allow `localhost:5173` in dev, configurable in prod.

## Tests

For each route:
- Happy path with seeded fixtures
- Empty result case
- Invalid query param → 400
- Unknown :id → 404

Use Fastify's `app.inject()` — no real HTTP needed.

## DONE WHEN

- [ ] All endpoints respond correctly against seeded fixture data
- [ ] OpenAPI spec or route list documented (use `@fastify/swagger` for free)
- [ ] `npm test` covers every endpoint with at least happy path + one error case
- [ ] `tsc --noEmit` passes
- [ ] Hitting each endpoint with curl returns valid JSON matching declared schemas
