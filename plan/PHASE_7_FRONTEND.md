# Phase 7 — Dashboard Frontend

React + Vite + Tailwind + Recharts. Single-page app, three top-level sections: Org → Teams → Developers. Plus admin section.

## Module structure

```
web/src/
  api/
    client.ts              # typed fetch wrapper
    hooks.ts               # SWR or @tanstack/react-query hooks
    types.ts               # mirror of API response types (zod-inferred)
  components/
    Layout.tsx
    Nav.tsx
    StatCard.tsx
    CostBreakdownBar.tsx   # stacked bar: seats + usage
    TrendChart.tsx          # Recharts line, segmented at June 1
    DataTable.tsx           # sortable, filterable
    EmptyState.tsx
    LoadingSpinner.tsx
  pages/
    OrgOverview.tsx
    TeamList.tsx
    TeamDetail.tsx
    DeveloperList.tsx
    DeveloperDetail.tsx
    GitHubProductPage.tsx
    M365ProductPage.tsx
    AdminIdentity.tsx
    AdminPipelines.tsx
  hooks/
    useMonthFilter.ts
    useTeamFilter.ts
  lib/
    formatCurrency.ts
    formatDate.ts
    colors.ts              # consistent product/team color palette
```

## Tech choices

- **Routing:** `react-router-dom` v6, file-based not required (small app)
- **Data:** `@tanstack/react-query` — handles caching, refetch, loading states
- **Charts:** Recharts only (already in stack)
- **Tables:** Plain HTML + Tailwind for now; if sorting/filtering gets complex, add `@tanstack/react-table`
- **Forms:** `react-hook-form` + Zod resolver (only needed in admin pages)
- **State:** React Query for server state, `useState` for local. No Redux/Zustand.

## Pages

### Org Overview (`/`)

- Top: 4 stat cards — Total monthly cost, Active devs, Idle seats, Unmapped users
- Middle: Stacked area chart, 12mo trend, broken down by `gh_seats | gh_usage | m365_seats`. **Vertical line at June 1** with annotation "PRU → AI Credits"
- Bottom: Two side-by-side: Top 10 most expensive devs, Top 10 most expensive teams

### Team List (`/teams`)

- Sortable table: Team, Active Devs, Total Cost, Cost/Dev, Idle Seats
- Click row → Team Detail

### Team Detail (`/teams/:name`)

- Header: team name, MTD spend, projected EOM, optional budget bar (from config)
- Trend chart: 6mo cost by product
- Developer list (filtered to team)
- Top models for the team

### Developer List (`/developers`)

- Sortable, filterable by team
- Columns: Name, Team, GH Cost, M365 Cost, Acceptance Rate, Idle Status

### Developer Detail (`/developers/:displayName`)

- Header: identity, team, total monthly cost
- Cost breakdown bar (3-component)
- 6mo trend, segmented at June 1
- GH model mix donut
- M365 app activity heatmap (one row, one col per app, intensity = recency)
- Idle warnings if applicable

### GitHub Product (`/products/github`)

- Cost by model (bar)
- Acceptance rate vs completions cost (scatter — labeled "completions only, not chat/PRU")
- Daily cost trend, 30 days

### M365 Product (`/products/m365`)

- Adoption heatmap (devs × apps)
- Breadth distribution (histogram of app count)
- Inactive seats table
- **If hashing detected:** banner at top, per-user views replaced with aggregate-only

### Admin Identity (`/admin/identity`)

- File upload for CSV
- Show import results (X added, Y updated, Z errors with row numbers)
- Table of unmapped users with manual map form
- Edit/deactivate existing rows

### Admin Pipelines (`/admin/pipelines`)

- Table: pipeline, last run, status, duration, rows affected
- Manual trigger buttons per pipeline
- API drift log (last 50)
- Hashing status banner

## Cross-cutting

### Hashing-aware degradation

A `useHashingStatus()` hook returns `{ m365Hashed: bool }`. Every M365 per-user component checks this and renders an aggregate-only view + banner when true.

### June 1 boundary

`TrendChart` component takes optional `boundaries: { date, label }[]` prop. Renders a vertical reference line (Recharts `ReferenceLine`) with label. Pre-baked boundary for `2025-06-01` "PRU → AI Credits".

### Color palette (`lib/colors.ts`)

Consistent across all charts:
- GitHub Seat: `#1f2937` (slate-800)
- GitHub Usage: `#0969da` (GH blue)
- M365 Seat: `#0078d4` (MS blue)
- Idle/warning: `#d97706` (amber-600)
- Success: `#16a34a`
- Per-team: hash team name → HSL hue, fixed saturation/lightness

### Loading/empty/error

Every data-driven component handles all four states: loading, error, empty, populated. Use the `EmptyState` component for empty case with helpful CTA (e.g., "Import identity CSV to enable team views").

## Build

`npm run build` — outputs to `web/dist/`. Fastify serves static files from `web/dist/` in production via `@fastify/static`.

## DONE WHEN

- [ ] All pages render with seeded data, no console errors
- [ ] Navigation works between all sections
- [ ] Charts render and respond to filter changes
- [ ] Admin CSV import flow works end-to-end
- [ ] Manual pipeline trigger from admin page completes and shows updated status
- [ ] Production build (`npm run build`) succeeds, served by Fastify on `:3000`
- [ ] Lighthouse score >85 on dashboard pages (perf check)
- [ ] No TS errors (`tsc --noEmit` in `web/`)
