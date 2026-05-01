# Architectural Decisions

Rationale for non-obvious calls. Add new ones as you make them.

## SQLite over Postgres
Single-tenant dashboard, ~200k rows over 2 years. SQLite handles this trivially with WAL mode. No reason to add a separate DB process. Drizzle works identically.

## Drizzle over Prisma
Smaller runtime, no codegen step in CI, plain SQL escape hatch always available. Migrations are human-readable.

## Raw + facts split
Every external API response lands in a `raw_*` table verbatim before normalization. Two reasons:
1. Schema drift (especially GitHub June 1 transition) — preserve original payload so we can re-derive without re-pulling.
2. Debugging — when a downstream view shows weird numbers, the raw JSON is right there.

Cost: ~2x storage for ingest data. Acceptable.

## node-cron + BullMQ split
node-cron handles single-shot daily orchestration (cheap, in-process). BullMQ handles M365 per-user interaction history fanout — that's the only thing that needs queues + retries + concurrency control. Don't need BullMQ for the rest; it would be overkill.

## Idempotent upserts on natural keys
Every facts table has a natural primary key (e.g., `billing_month + username + sku + model`). Re-running a pipeline upserts. No "snapshot_id" autoincrement that would let dupes accumulate.

## React Query over Redux/Zustand
All meaningful state is server state. React Query handles caching, refetching, loading/error states out of the box. Local UI state (filters, sort) lives in `useState`. No global store needed.

## Recharts over D3
D3 is overkill for bar/line/scatter/heatmap. Recharts gives 90% of what we need with React-idiomatic API. If a specific chart needs D3 later, add it for that one chart only.

## Hashed UPN as degraded mode, not blocker
M365 hashing means we can't track per-user M365 stats longitudinally. Rather than blocking the entire M365 dashboard, render aggregate-only views with a banner. User can choose to disable hashing and get full functionality.

## Separate seat license cost from usage cost
Three cost components are tracked and displayed independently: GitHub seat license (flat), GitHub usage (variable PRU/credits), M365 seat license (flat). Never blended into one number — finance needs the breakdown for budgeting.

## Identity map is a hard prerequisite for team views
Without `identity_map` populated, team-level endpoints return empty with a clear message. Unmapped users land in an "Unmapped" bucket visible to admins. We don't try heuristic auto-matching of GH usernames to UPNs — that's brittle and silently wrong.

## June 1 boundary handled at chart layer, not data layer
Trend charts render a vertical reference line at June 1 with annotation. Data is stored as-is in both pre/post units; the dashboard makes the regime change visible rather than trying to retroactively normalize.

## No microservices
Single Fastify process + single worker process. Domain boundaries are clear, but volume is tiny and complexity doesn't justify even that split. Could become two services later if needed.

## Vitest over Jest
Faster, native TS, works with ESM out of the box. No reason to use Jest for a new project.
