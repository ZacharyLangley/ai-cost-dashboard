# Open Questions

Resolve before or during the relevant phase. Add new questions as they surface.

## Setup blockers (resolve before Phase 2)

- [ ] **GitHub org on enhanced billing platform?** Verify at `github.com/organizations/{org}/settings/billing/summary`. Hard blocker for `/premium_request/usage`.
- [ ] **GitHub org or enterprise account?** Enterprise unlocks NDJSON per-user reports (`/enterprises/{ent}/copilot/metrics/...`). Org-only = aggregate metrics only.
- [ ] **GitHub fine-grained PAT or App?** App preferred (no manual rotation). If PAT, who owns rotation?
- [ ] **"Copilot Metrics API access policy"** enabled in org settings? Otherwise metrics endpoints 404.

## Setup blockers (resolve before Phase 3)

- [ ] **Azure tenant: M365 obfuscation toggle.** Can it be disabled? If not, accept aggregate-only M365 views for per-user data.
- [ ] **Global Admin access** for `Reports.Read.All` + `CopilotInteractionHistory.Read.All` consent. Who grants this?
- [ ] **Azure app registration** created? Tenant ID, client ID, client secret captured?

## Setup blockers (resolve before Phase 4)

- [ ] **Identity source.** Manual CSV for v1, or pull from HRIS (Workday/BambooHR/Okta SCIM)?
- [ ] **Team taxonomy stable?** If frequent reorgs, identity_map needs effective-dating beyond start/end_date — possibly a separate `team_history` table.
- [ ] **Cost center attribution required?** If yes, who maintains the team → cost-center mapping?

## Operational (resolve before Phase 8)

- [ ] **Alert channel.** Slack webhook URL? PagerDuty? Just logs for v1?
- [ ] **Backup destination.** Local filesystem only, or sync to S3/Azure Blob?
- [ ] **Where does this run?** Single VM, container, laptop? Affects backup + cron strategy.
- [ ] **Who has access?** Auth/SSO needed for the dashboard, or assumed local-only?

## Speculative — confirm against real APIs (PENDING_REAL_API)

- [ ] **GitHub `/premium_request/usage` response shape with no user filter** — implemented assuming `{ usageItems: [{ user: string, ...item }] }`. If the endpoint returns aggregate only (no per-user breakdown without `?user=` filter), `ingest-usage.ts` needs to enumerate org members first and call per-user. First real call will tell us. See `src/pipelines/github/ingest-usage.ts` `[SPECULATION]` comment.
- [ ] **GitHub June 1 schema.** When does `unitType` shift to `tokens`? Does `usageItem` gain `inputTokens`/`outputTokens` fields?
- [ ] **M365 hashed UPN format.** Confirmed regex pattern after first real pull.
- [ ] **M365 interactionHistory rate limits.** Beta endpoints — what are actual throttling limits at 100+ user fanout?

## Product

- [ ] **Budget allotments per team.** Source? Manual config file, or pulled from finance system?
- [ ] **Cost-center rollup needed?** If yes, surface in dashboard or export only?
- [ ] **Multi-tenancy.** One installation per org always, or could one instance serve multiple orgs eventually?
- [ ] **Historical data ownership.** When a developer leaves, do we delete their data, anonymize, or retain for finance audit?
