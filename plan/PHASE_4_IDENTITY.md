# Phase 4 — Identity Map

The bridge between GitHub usernames, M365 UPNs, and team/cost-center attribution. Without it, no team views work.

## Tasks

### 1. CSV importer

`src/services/identity/csv-import.ts`

Expected CSV format:

```csv
display_name,gh_username,m365_upn,team,cost_center,start_date,end_date
Jane Doe,janedoe,jane.doe@acme.com,Platform,CC-ENG-01,2024-01-15,
John Smith,jsmith,john.smith@acme.com,Mobile,CC-ENG-02,2023-06-01,
```

Parser:
- Required: `display_name`, `team`, at least one of `gh_username`/`m365_upn`
- Optional: `cost_center`, `start_date`, `end_date`
- Trims whitespace, normalizes UPN to lowercase, GH username case-preserved
- Validates with Zod row-by-row
- Returns `{ valid: Row[], errors: { row: number, message: string }[] }`

Upsert strategy: on conflict on `gh_username` OR `m365_upn`, update other fields. Never delete — set `end_date` to deactivate.

### 2. Admin endpoints

```
POST   /api/admin/identity/import       # multipart CSV upload
GET    /api/admin/identity              # list all
GET    /api/admin/identity/unmapped     # users in usage tables not in identity_map
PATCH  /api/admin/identity/:id          # edit single row
DELETE /api/admin/identity/:id          # soft delete (sets end_date)
```

### 3. Unmapped detection query

```sql
SELECT DISTINCT username AS identifier, 'github' AS source
FROM gh_usage_facts
WHERE username NOT IN (SELECT gh_username FROM identity_map WHERE gh_username IS NOT NULL)

UNION ALL

SELECT DISTINCT upn AS identifier, 'm365' AS source
FROM m365_usage_facts
WHERE upn_is_hashed = 0
  AND upn NOT IN (SELECT m365_upn FROM identity_map WHERE m365_upn IS NOT NULL);
```

(Hashed UPNs excluded — can't map them anyway.)

### 4. Resolver service

`src/services/identity/resolver.ts`

```ts
export async function resolveByGithub(username: string): Promise<IdentityRow | null>
export async function resolveByUpn(upn: string): Promise<IdentityRow | null>
export async function resolveTeamForGithub(username: string): Promise<string>  // 'Unmapped' fallback
export async function resolveTeamForUpn(upn: string): Promise<string>
```

In-memory LRU cache (1000 entries, 5min TTL) — these get hit on every aggregation query.

### 5. Tests

- CSV with valid + invalid rows → only valid imported, errors returned
- Upsert: re-import same CSV, no duplicates
- Unmapped query returns expected users after seeding fixtures
- Resolver returns 'Unmapped' for unknown identifiers, never throws

## DONE WHEN

- [ ] All endpoints functional, tested with curl
- [ ] Sample CSV (10 rows, 2 errors) imports correctly: 8 inserted, 2 errors returned
- [ ] Unmapped endpoint returns users from fixture data not in identity_map
- [ ] Resolver cache hit rate >90% on repeated lookups (log and verify)
- [ ] `tsc --noEmit` passes, `npm test` green
