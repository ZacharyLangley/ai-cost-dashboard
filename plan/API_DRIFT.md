# API Drift Log

When an external API returns something the schema didn't expect, document it here. Pipelines write to `api_drift_log` table; this file is the human-curated record of what we've decided to do about each.

## Format

```
## YYYY-MM-DD — [Source] [Field path]

**Observed:** what came back
**Expected:** what schema said
**Decision:** ignore | log-only | adapt-schema | block

**Action taken:** code change / config change / wait-and-see
```

---

## Examples (delete when real entries exist)

## 2026-04-30 — github /premium_request/usage usageItem.unitType

**Observed:** `"tokens"` on rows for model `claude-opus-4-5`
**Expected:** `"requests"` (per pre-June schema)
**Decision:** adapt-schema

**Action taken:** unit_type stored as raw string, downstream cost view groups by unit_type to avoid mixing requests + tokens in a single bar. Added comment to `gh_usage_facts` noting both values valid post-June.

---

## 2026-05-15 — m365 interactionHistory.appContext

**Observed:** new value `"loop"` (M365 Loop)
**Expected:** known set: teams, word, excel, ppt, outlook, chat
**Decision:** log-only

**Action taken:** added `loop` to known apps list in M365 product page rendering. No schema change needed — `app_context` is a free-form string.
