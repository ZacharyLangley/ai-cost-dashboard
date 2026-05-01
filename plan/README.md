# Plan Index

Read in order. Each phase has its own DONE WHEN gate — don't skip ahead.

| File | Purpose |
|---|---|
| `../CLAUDE.md` | Root execution prompt — Claude Code reads this on every session |
| `SPEC.md` | Original product spec |
| `DECISIONS.md` | Architectural rationale |
| `OPEN_QUESTIONS.md` | Unresolved blockers, grouped by phase |
| `API_DRIFT.md` | External API surprises and how we handled them |
| `PHASE_0_SCAFFOLD.md` | Project setup, all three processes running |
| `PHASE_1_SCHEMA.md` | All DB tables, all indexes |
| `PHASE_2_GITHUB_PIPELINE.md` | GitHub Copilot ingest |
| `PHASE_3_M365_PIPELINE.md` | M365 Copilot ingest |
| `PHASE_4_IDENTITY.md` | Identity map + CSV import |
| `PHASE_5_DERIVED.md` | Computed fields, rollups, scheduling |
| `PHASE_6_API.md` | Read API for the dashboard |
| `PHASE_7_FRONTEND.md` | React dashboard |
| `PHASE_8_POLISH.md` | Hardening, alerting, docs |

## Working with Claude Code

When starting a session, paste this:

> Read `CLAUDE.md` and `plan/PHASE_N_*.md`. Confirm you understand the goals and DONE WHEN criteria, then start implementing. Ask before deviating from the spec.

When ending a phase:

> Run the verification commands at the bottom of `plan/PHASE_N_*.md` and paste output. If all green, update `DECISIONS.md` with anything notable from this phase, then we'll move to N+1.

When something doesn't fit the plan:

> Don't improvise. Add the question to `plan/OPEN_QUESTIONS.md` and stop. Show me what you found.
