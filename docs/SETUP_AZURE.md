# Azure / M365 App Registration Setup

## Required permissions

Application (not delegated) permissions — requires Global Admin or Reports Admin for consent:

| Permission | API | Required for |
|---|---|---|
| `Reports.Read.All` | Microsoft Graph | M365 Copilot usage reports |
| `CopilotInteractionHistory.Read.All` | Microsoft Graph | Per-user interaction history (optional, beta) |

## Create app registration

1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations → New registration
2. Name: `ai-cost-dashboard`
3. Supported account types: "Accounts in this organizational directory only"
4. Redirect URI: leave blank (service-to-service auth)
5. Click Register → note the **Application (client) ID** and **Directory (tenant) ID**

## Add permissions

1. In your app registration: API permissions → Add a permission → Microsoft Graph → Application permissions
2. Search and add: `Reports.Read.All`
3. Optional: add `CopilotInteractionHistory.Read.All` (beta — may not appear; add via manifest)
4. Click **Grant admin consent for {tenant}** — requires Global Admin

## Create client secret

1. Certificates & secrets → Client secrets → New client secret
2. Description: `ai-cost-dashboard`, Expiration: 24 months
3. Copy the **Value** immediately (only shown once) → `AZURE_CLIENT_SECRET` in `.env`
4. Note expiry date — set a calendar reminder to rotate before it expires

## Configure .env

```
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Verify

```bash
# Get token
curl -X POST "https://login.microsoftonline.com/$AZURE_TENANT_ID/oauth2/v2.0/token" \
  -d "client_id=$AZURE_CLIENT_ID&client_secret=$AZURE_CLIENT_SECRET&scope=https://graph.microsoft.com/.default&grant_type=client_credentials" \
  | jq -r .access_token > /tmp/token.txt

# Test Reports.Read.All
curl -H "Authorization: Bearer $(cat /tmp/token.txt)" \
  "https://graph.microsoft.com/v1.0/copilot/reports/getMicrosoft365CopilotUsageUserDetail(period='D30')?\$format=application/json"
```

Expected: 200 with JSON user activity. If 403: admin consent not granted.

## UPN hashing

If display names look like hashes (`0kFXvlFz...`), UPN obfuscation is enabled:

1. Go to M365 Admin Center → Reports → Privacy settings
2. Disable "Display concealed user, group, and site names in reports"

This requires Reports Admin or Global Admin. The dashboard degrades gracefully with a banner if hashing is detected.

## Secret rotation

When M365 pipeline fails with 401:
1. Create new client secret in Azure portal
2. Update `AZURE_CLIENT_SECRET` in `.env`
3. Restart API process
4. Optionally delete the old secret
