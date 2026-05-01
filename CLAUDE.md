# Copilot Cost Dashboard

Local-first dashboard tracking GitHub Copilot (usage-based) and M365 Copilot (seat-based) spend across developers and teams.

## Stack — non-negotiable

- **Backend:** Fastify + TypeScript (strict)
- **DB:** SQLite via Drizzle ORM
- **Scheduler:** node-cron (orchestration) + BullMQ + ioredis (M365 per-user fanout only)
- **Frontend:** React + Vite + Tailwind + Recharts
- **Validation:** Zod
- **Logging:** Pino
- **Auth secrets:** env vars only, never in DB
- **Single-command dev:** `npm run dev` starts API + worker + Vite

No Docker. No microservices. No Prisma. No styled-components.

## Code conventions

- TypeScript strict mode, no `any` without comment justifying it
- Routes → service → repository pattern
- Zod schemas at every boundary (API input, external API response, DB row → domain object)
- Named exports only, no default exports except React route components
- Functions over classes unless wrapping stateful resources
- Repository functions return domain objects, not Drizzle row types
- All external API calls wrapped in service modules with their own retry/error handling
- Raw API payloads preserved in `raw_*` tables — normalize on read into `*_facts` tables
- Idempotent upserts everywhere — re-running any pipeline must not duplicate

## Security conventions

- **SSRF**: call `assertSafeUrl()` from `src/lib/safe-fetch.ts` before any `fetch()` that takes a URL from external API data (not from env config)
- **Admin/meta routes** (`/api/admin/*`, `/api/meta/*`) are wrapped in an `internalOnly` scope — only reachable from localhost. Do not move them outside this scope.
- **Pino redact**: add new secret field paths to the redact list in `src/lib/logger.ts` rather than logging and filtering later
- **Error handler**: unknown errors must never surface stack traces or internal message details to HTTP clients — only `{ error: 'Internal server error', requestId }`. Only `NotFoundError`, `ValidationError`, `ZodError` get custom responses.
- **Security tests** live in `src/api/__tests__/security/` — add a test whenever a new security control is added

## Project layout

```
src/
  config/          env parsing, constants
  db/              schema, migrations, drizzle client
  services/
    github/        GitHub Copilot API client
    m365/          MS Graph API client
    identity/      identity_map operations
  pipelines/
    github/        ingestion orchestration
    m365/          ingestion orchestration
    derived/       computed fields, rollups
  jobs/            cron + BullMQ definitions
  api/
    routes/        Fastify route handlers
    schemas/       Zod request/response schemas
    __tests__/
      security/    security regression tests (headers, SSRF, error handler)
  lib/             shared utilities (logger, errors, safe-fetch, redis, notify)
web/
  src/
    components/
    pages/
    hooks/
    api/           typed API client
```

## Working preferences

- **Lead with the answer.** No "I'll now create..." preambles.
- **Terse.** Skip basics, treat me as senior.
- **Show changed lines only** when editing — not full file rewrites.
- **Flag speculation.** Mark guesses as `[SPECULATION]`.
- **Respect Prettier config** in `.prettierrc`.
- **No moral lectures.** Safety only when non-obvious.

## Phase execution

Build in numbered phases under `plan/`. Each phase has:
- `plan/PHASE_N.md` — what to build, in what order, with verification steps
- A clear "DONE WHEN" checklist at the bottom

**Do not start phase N+1 until phase N's DONE WHEN checklist passes.** Run the verification commands and paste output into the conversation before moving on.

## When stuck

1. Check `plan/DECISIONS.md` for prior architectural calls
2. Check `plan/OPEN_QUESTIONS.md` — if blocked, add to it and ask
3. If an external API behaves differently than spec says, preserve raw payload and add to `plan/API_DRIFT.md`

## What lives where

- **Architecture rationale:** `plan/DECISIONS.md`
- **Phase plans:** `plan/PHASE_*.md`
- **API contract drift log:** `plan/API_DRIFT.md`
- **Unresolved questions:** `plan/OPEN_QUESTIONS.md`
- **Original spec:** `plan/SPEC.md`
