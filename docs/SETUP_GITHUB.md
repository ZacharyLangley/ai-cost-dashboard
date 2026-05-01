# GitHub Credentials Setup

## Required permissions

Create a **Fine-grained PAT** (or GitHub App installation token):

| Permission | Level | Required for |
|---|---|---|
| `Administration` | Read | Org billing endpoints |
| `manage_billing:copilot` | Read | `/premium_request/usage`, `/seats` |
| `read:org` | Read | Org member list |
| `read:enterprise` | Read | Enterprise metrics NDJSON reports (optional) |

## Create a Fine-grained PAT

1. Go to: `github.com/settings/personal-access-tokens/new`
2. Token name: `ai-cost-dashboard`
3. Expiration: set a reminder to rotate before it expires
4. Resource owner: select your **organization** (not personal account)
5. Repository access: "All repositories" or "No repositories" — billing APIs are org-level
6. Permissions:
   - Under **Organization permissions**: Administration → Read-only, Members → Read-only
   - If using enterprise metrics: add `manage_billing:copilot` under Enterprise permissions
7. Generate token → copy to `GITHUB_TOKEN` in `.env`

## Enable Copilot Metrics API

Required for `/copilot/metrics` endpoint:

1. Go to: `github.com/organizations/{YOUR_ORG}/settings/copilot/policies`
2. Enable "Copilot Metrics API access policy"

Without this, `/api/metrics` returns 404 even with correct token.

## Enhanced billing platform

Required for `/premium_request/usage`:

1. Check: `github.com/organizations/{YOUR_ORG}/settings/billing/summary`
2. Look for "Enhanced billing platform" status
3. If not enabled, contact GitHub sales or check your Enterprise plan

Without enhanced billing, the usage endpoint returns 404.

## Verify your token

```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "X-GitHub-Api-Version: 2022-11-28" \
     "https://api.github.com/orgs/YOUR_ORG/copilot/billing/seats"
```

Expected: 200 with JSON array. If 403: wrong permissions. If 404: enhanced billing not enabled.

## Token rotation

PATs expire. When the GitHub pipeline fails with 401, rotate:
1. Generate new token at github.com/settings/tokens
2. Update `GITHUB_TOKEN` in `.env`
3. Restart API process

Set `OPS_WEBHOOK_URL` in `.env` to get a Slack notification when pipeline 401s.
