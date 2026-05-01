# Copilot Cost Dashboard — Plan Spec

Two separate ingestion pipelines feeding one dashboard. Different APIs, different data shapes, different auth models.

---

## Dashboard 1 — GitHub Copilot (Usage-Based Billing)

### Data Sources

**Primary — per-user cost breakdown:**

```
GET /organizations/{org}/settings/billing/premium_request/usage
  ?user={username}&year=YYYY&month=MM
```

Response shape per `usageItem`:

```json
{
  "product": "Copilot",
  "sku": "Copilot Premium Request",
  "model": "claude-sonnet-4-6",
  "unitType": "requests",
  "pricePerUnit": 0.04,
  "grossQuantity": 100,
  "grossAmount": 4,
  "discountQuantity": 0,
  "discountAmount": 0,
  "netQuantity": 100,
  "netAmount": 4
}
```

Filterable by `user`, `model`, `product` — all query params.

**Secondary — seat activity (who's actually active):**

```
GET /orgs/{org}/copilot/billing/seats
```

Gives `last_activity_at` per seat — use this to flag inactive seats burning money.

**Tertiary — engagement metrics:**

```
GET /orgs/{org}/copilot/metrics
GET /enterprises/{enterprise}/copilot/metrics/reports/users-1-day?day=DAY
GET /enterprises/{enterprise}/copilot/metrics/reports/users-28-day/latest
```

The enterprise endpoints return download links to NDJSON blobs — fetch and parse them.

### Auth

- Fine-grained PAT or GitHub App installation token
- Required permissions: `Administration: read` (org) + `manage_billing:copilot`
- For enterprise metrics: `manage_billing:copilot` or `read:enterprise`
- Enable "Copilot Metrics API access policy" in org settings or it 404s

### Key Constraints

- Enhanced billing platform required for `/premium_request/usage` — verify your org is on it
- Metrics processed once/day; data lags up to 2 full UTC days
- Users must have telemetry enabled in their IDE to appear in metrics
- 100 days of historical metrics max; 24 months for billing data
- **June 1:** PRUs replaced with AI Credits — `unitType` will shift, `model` field becomes critical for cost attribution

### Data Model (normalized)

```
developer_usage {
  date            date
  username        string
  model           string
  gross_qty       int       -- requests or tokens post-June
  net_cost        decimal
  seat_active     bool      -- from /seats join
  suggestions     int       -- from /metrics
  acceptances     int
  acceptance_rate decimal
}
```

### Views to Build

| View | Type | Notes |
|---|---|---|
| Cost by developer | Bar chart | Sortable, current month + trend vs last month |
| Cost by model | Bar chart | Opus vs Sonnet gap is 5× on output tokens |
| Inactive seats | Table | `last_activity_at` > 30d, cost-per-idle-seat calc |
| Acceptance rate vs cost | Scatter plot | High cost + low acceptance = bad ROI signal |
| Budget burn | Line chart | Daily spend rate vs monthly credit allotment, projected overage |

---

## Dashboard 2 — Microsoft 365 Copilot (Graph API)

### Data Sources

**Primary — per-user activity detail:**

```
GET https://graph.microsoft.com/v1.0/copilot/reports/getMicrosoft365CopilotUsageUserDetail(period='D30')
  ?$format=application/json
```

Response shape per user:

```json
{
  "reportRefreshDate": "2026-04-29",
  "userPrincipalName": "hashed-or-obfuscated",
  "displayName": "hashed-or-obfuscated",
  "lastActivityDate": "2026-04-29",
  "copilotChatLastActivityDate": "2026-04-25",
  "microsoftTeamsCopilotLastActivityDate": "2026-04-29",
  "wordCopilotLastActivityDate": "2026-04-20",
  "excelCopilotLastActivityDate": "",
  "powerPointCopilotLastActivityDate": "",
  "outlookCopilotLastActivityDate": "",
  "copilotActivityUserDetailsByPeriod": [{ "reportPeriod": 30 }]
}
```

> **Important:** UPNs and display names are **hashed by default** for privacy. To get real names, an admin must disable obfuscation in M365 admin center (`Reports > Privacy settings > Show user details`). Build the pipeline to handle both modes.

**Secondary — interaction-level detail (beta, public preview):**

```
GET https://graph.microsoft.com/beta/copilot/users/{userId}/interactionHistory/allEnterpriseInteractions
```

Returns actual prompt/response pairs with app context, timestamps, and token-adjacent metadata. Much more granular than the usage report — use this for real activity signal.

**Pagination:** Both endpoints use `@odata.nextLink`. Default page size is 200. Must paginate to get full org.

### Auth

- Azure AD app registration with `Reports.Read.All` permission (application permission, admin consent required)
- For interaction history: additional `CopilotInteractionHistory.Read.All` permission
- Auth flow: client credentials (service-to-service), MSAL token exchange against `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`
- Tenant ID + client ID + client secret stored in env

### Key Constraints

- **No token counts, no cost data** — M365 Copilot is seat-licensed ($18–30/user/mo), not token-billed. Cost here is `active_users × seat_cost`, not token attribution.
- Activity data is binary per app per day — one Teams interaction = "active in Teams". Not a count.
- Interaction history API is beta/preview — subject to change, may have rate limits
- Period options: `D7`, `D30`, `D90`, `D180`

### Data Model (normalized)

```
m365_developer_usage {
  report_date       date
  upn               string   -- may be hashed
  display_name      string   -- may be hashed
  last_activity     date
  active_apps       string[] -- Teams, Word, Excel, etc.
  app_count         int      -- breadth of adoption
  days_since_active int      -- computed
  seat_cost         decimal  -- flat rate from config
  interaction_count int      -- from interactionHistory if enabled
}
```

### Views to Build

| View | Type | Notes |
|---|---|---|
| Adoption by app | Heatmap / grouped bar | Which apps each dev actually uses |
| Inactive seat table | Table | Licensed users with no activity in X days, monthly cost wasted |
| Breadth score | Sorted list | Devs using 1 app vs 5+; drives enablement decisions |
| Activity trend | Line chart | 7/30/90 day active user counts over time |
| Cost efficiency | Bar chart | Seat cost ÷ interaction count (requires interactionHistory) |

---

## Shared Infrastructure

### Stack

Fits existing Job Hunter / StoryEngine patterns:

| Layer | Choice |
|---|---|
| Backend | Fastify + TypeScript |
| Database | SQLite via Drizzle ORM |
| Scheduler | node-cron or BullMQ for daily pulls |
| Frontend | React + Vite + Tailwind |
| Charts | Recharts |
| Auth secrets | env vars only, never in DB |

### Ingestion Pipeline (daily job)

```
1. Pull GitHub /premium_request/usage for all org members → upsert
2. Pull GitHub /seats → join + flag inactive
3. Pull GitHub enterprise metrics reports (download links → fetch NDJSON → parse)
4. Pull M365 usage detail (paginate through all users via @odata.nextLink)
5. Pull M365 interaction history if enabled (paginate per user — expensive, optional)
6. Write snapshot to SQLite
7. Compute derived fields (acceptance_rate, days_since_active, cost_per_interaction, etc.)
```

### DB Schema (sketch)

```sql
-- GitHub
CREATE TABLE gh_usage_snapshots (
  id            INTEGER PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  username      TEXT NOT NULL,
  model         TEXT NOT NULL,
  gross_qty     INTEGER,
  net_cost      REAL,
  seat_active   INTEGER, -- bool
  suggestions   INTEGER,
  acceptances   INTEGER
);

-- M365
CREATE TABLE m365_usage_snapshots (
  id                INTEGER PRIMARY KEY,
  snapshot_date     TEXT NOT NULL,
  upn               TEXT NOT NULL,
  display_name      TEXT,
  last_activity     TEXT,
  active_apps       TEXT, -- JSON array
  app_count         INTEGER,
  days_since_active INTEGER,
  seat_cost         REAL,
  interaction_count INTEGER
);
```

---

## Open Questions to Resolve Before Building

1. **Enhanced billing platform** — Is your GitHub org on it? If not, `/premium_request/usage` 404s. Check: `github.com/organizations/{org}/settings/billing/summary`.
2. **GitHub org vs enterprise** — Enterprise unlocks the NDJSON report endpoints with per-user granularity.
3. **M365 privacy obfuscation** — Is UPN hashing enabled in your tenant? Determines whether display names are usable or require a Graph `users` join to de-hash.
4. **Azure AD app registration rights** — Do you have rights to grant `Reports.Read.All` + admin consent? Needs a Global Admin or Reports Admin.
5. **Post-June 1 schema drift** — Confirm whether GitHub `unitType` shifts to `tokens` after June 1 billing transition. The announcement says token-based but the API schema hasn't been formally updated. May need a migration on the ingestion layer.
6. **M365 interactionHistory cost** — Fetching per-user interaction history is a call per user. At scale (100+ devs) this is expensive. Consider fetching weekly rather than daily, or only for flagged users.
