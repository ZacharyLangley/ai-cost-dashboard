# Identity CSV Format

Used to map GitHub usernames to M365 UPNs and assign developers to teams.

## Columns

| Column | Required | Description |
|---|---|---|
| `gh_username` | One of these two | GitHub username (login), e.g. `alice-dev` |
| `m365_upn` | One of these two | M365 User Principal Name, e.g. `alice@company.com` |
| `display_name` | No | Display name shown in dashboard. Defaults to `gh_username` |
| `team` | No | Team name. Defaults to `Unmapped` |

At least one of `gh_username` or `m365_upn` must be present per row.

## Example

```csv
gh_username,m365_upn,display_name,team
alice-dev,alice@company.com,Alice Johnson,Platform
bob-codes,bob@company.com,Bob Smith,Backend
carol-eng,,Carol Williams,Backend
,diana@company.com,Diana Prince,Frontend
```

## Import behavior

- **New row** (neither gh_username nor m365_upn exists in DB): inserted
- **Existing row** (match found by gh_username or m365_upn): updated with provided fields; missing fields retain existing values
- **Blank row**: skipped
- **Missing both gh_username and m365_upn**: reported as row error, skipped

## Import via UI

Admin → Identity → Import CSV → select file → Import

Results show: X added, Y updated, Z errors with row numbers.

## Import via API

```bash
curl -X POST localhost:3000/api/admin/identity/import \
  -H "Content-Type: application/json" \
  -d '{"rows": [{"ghUsername": "alice-dev", "m365Upn": "alice@company.com", "displayName": "Alice", "team": "Platform"}]}'
```

## Effect on dashboard

- Developers without identity entries appear in "Unmapped" team bucket
- Team views only show teams that exist in `identity_map`
- M365 per-user stats join on `m365_upn`; without mapping, M365 data is unlinked from GitHub data
- `unmappedCount` on Org Overview shows how many GitHub users have usage but no identity entry

## Deactivating developers

Developers who leave can be removed from `identity_map` — they retain historical data in usage tables but stop appearing in current-month views.
