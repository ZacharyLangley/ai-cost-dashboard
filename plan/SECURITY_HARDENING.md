# Post-Build Security Hardening Plan
## Copilot Cost Dashboard — Outside Authentication

Addresses gaps identified in audit of v1. Reorganized around a threat model, with explicit costs and verification commands per control.

---

## Threat Model

What this plan defends against, in priority order:

1. **Credential theft from disk or memory** — GitHub tokens and Azure client secrets are the most valuable assets. Compromise enables unauthorized access to org billing data and M365 telemetry.
2. **Data exfiltration** — Identity map, cost attribution, and per-developer activity data is sensitive (salary-adjacent, performance-adjacent). Leakage is a privacy and HR liability.
3. **Supply chain compromise** — Dependency tree is ~600+ packages. A single compromised maintainer or typosquat could yield code execution.
4. **Lateral movement from compromised dev machine** — If Zack's laptop is compromised, the dashboard becomes a pivot to GitHub org admin and Azure tenant data.
5. **Denial of service** — Less critical for an internal tool but worth basic protection against runaway loops, malformed input, and resource exhaustion.

**Out of scope (not because unimportant, but because outside this plan's authority):**
- Authentication/authorization (separate plan)
- Network perimeter security (assumes deployment environment handles this)
- Physical security of host machine
- OS-level hardening beyond file permissions

---

## Source Credibility Legend

Sources tagged throughout. Apply weight accordingly.

- **[A]** Authoritative — official docs, RFCs, project security advisories
- **[V]** Vendor — has commercial interest in the recommendation
- **[O]** Opinion — blog post, individual practitioner

---

## Layer 1 — HTTP Hardening

**Defends against:** DoS, XSS, clickjacking, MIME sniffing attacks, missing TLS enforcement
**Time:** 2–4 hours (not 30 minutes — CSP configuration takes real work)

### 1.1 Security headers via Helmet

```ts
import helmet from '@fastify/helmet';

fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],                    // tighten if no inline scripts
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind injects inline styles
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],                    // API origin
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
  } : false,
});
```

**Cost / trade-offs:**
- CSP will break the React app on first load if misconfigured. Plan a debugging session.
- HSTS only applies under HTTPS — disable in localhost dev to avoid sticky browser behavior.
- Helmet's actual default header count is ~10, several deprecated by browsers. Don't fixate on the count.

**Skip if:** dashboard is served behind a reverse proxy already setting these headers (avoid double-set conflicts).

**Verification:**
```bash
curl -I http://localhost:3000/api/health | grep -iE 'strict-transport|content-security|x-content-type|x-frame|referrer-policy'
# Expect: 5+ security headers present
```

### 1.2 Rate limiting

```ts
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  global: false,                    // opt-in per route
  max: 100,
  timeWindow: '15 minutes',
});

// Stricter on admin routes — resource protection, not anti-credential-stuffing
// (this app has no auth to brute-force; rate limits are about resource abuse)
fastify.register(adminRoutes, {
  config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
});
```

**Cost:** Negligible. Adds latency from in-memory counter check.

**Verification:**
```bash
for i in {1..15}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/pipelines/runs; done
# Expect: 429 status code starting around request 11
```

### 1.3 CORS

```ts
import cors from '@fastify/cors';

fastify.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://dashboard.example.com']
    : ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  maxAge: 86400,
});
```

**Verification:**
```bash
curl -H "Origin: https://evil.com" -I http://localhost:3000/api/health | grep -i access-control-allow-origin
# Expect: header absent or matches allowlist
```

### 1.4 Outbound egress / SSRF protection

The Phase 2 GitHub pipeline fetches presigned NDJSON URLs from GitHub's API response. The URL comes from external data, not config — this is the highest-risk fetch in the codebase.

```ts
// src/lib/safe-fetch.ts
const ALLOWED_HOSTS = [
  'api.github.com',
  'objects.githubusercontent.com',
  'github-cloud.s3.amazonaws.com',
  'graph.microsoft.com',
];

export function assertSafeUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error(`Refusing non-HTTPS URL: ${parsed.protocol}`);
  }
  if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))) {
    throw new Error(`URL host not in allowlist: ${parsed.hostname}`);
  }
}
```

Call `assertSafeUrl()` before every fetch in `services/github/` and `services/m365/`. Never set `rejectUnauthorized: false` on TLS connections (Node's default is correct).

**Cost:** Negligible. One URL parse per fetch.

**Verification:**
```bash
npm test -- safe-fetch
# Test cases: valid GitHub URL passes, http:// rejected, evil.com rejected
```

### Sources for Layer 1
- [@fastify/helmet documentation](https://github.com/fastify/fastify-helmet) **[A]**
- [Helmet.js docs — actual default headers](https://helmetjs.github.io/) **[A]**
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/) **[A]**
- [@fastify/rate-limit documentation](https://github.com/fastify/fastify-rate-limit) **[A]**
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) **[A]**

---

## Layer 2 — Input Validation

**Defends against:** Injection, deserialization attacks, resource exhaustion via malformed input
**Time:** 4–6 hours audit + patches

### 2.1 Verify Zod coverage

```bash
# Find route handlers without schema validation
grep -rn "fastify\.\(get\|post\|patch\|delete\)" src/api/routes/
# Each match should have a corresponding Zod schema in src/api/schemas/
```

Specifically audit:
- Query params (sort, filter, date ranges) — common injection vector
- CSV upload validation — row-by-row Zod, reject upload on schema violation, return error details
- Request body size limits — Fastify default is 1MB, may need lower for some routes

```ts
fastify.register(adminRoutes, {
  bodyLimit: 5 * 1024 * 1024,  // 5MB for CSV uploads
});
```

**Cost:** Validation overhead is minimal. Strict size limits may reject legitimate large uploads — set per-route, not globally.

### 2.2 Path traversal

If any endpoint accepts a filename or path component, resolve and verify it stays in the expected directory:

```ts
import path from 'node:path';

function safeResolve(userInput: string, base: string): string {
  const resolved = path.resolve(base, userInput);
  if (!resolved.startsWith(path.resolve(base) + path.sep)) {
    throw new Error('Path traversal attempt');
  }
  return resolved;
}
```

**Verification:**
```bash
npm test -- input-validation
# Tests: oversized payload rejected, invalid types rejected, path traversal rejected
```

### Sources for Layer 2
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) **[A]**
- [Zod documentation](https://zod.dev/) **[A]**
- [Fastify validation docs](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) **[A]**

---

## Layer 3 — Database & Storage

**Defends against:** SQL injection, unauthorized file access, data exposure on disk, backup compromise
**Time:** 3–5 hours

### 3.1 SQLite PRAGMAs

Set on connection open in `src/db/client.ts`:

```ts
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');  // FULL is overkill with daily backups
db.pragma('temp_store = MEMORY');
// secure_delete: see trade-off note below
```

**Trade-off on `secure_delete`:**
| Setting | Behavior | Cost |
|---|---|---|
| `OFF` (default) | Deleted rows leave content on disk pages until overwritten | None |
| `ON` | Overwrites deleted content with zeros | 10–30% write throughput hit |
| `FAST` | Overwrites only when easy/cheap | <5% |

For a daily-ingest workload with full-disk encryption (FileVault/LUKS/BitLocker) on the host, `OFF` or `FAST` is fine. Use `ON` only if backups are unencrypted and disk encryption isn't in place.

### 3.2 File permissions (with TOCTOU mitigation)

```bash
# At install time
chown appuser:appuser data/
chmod 700 data/
chmod 600 data/copilot.db*
```

WAL/SHM files inherit directory mode if umask is right. Add a startup check:

```ts
// src/lib/verify-permissions.ts
import { statSync } from 'node:fs';

export function verifyDbPermissions(dbPath: string): void {
  const mode = statSync(dbPath).mode & 0o777;
  if (mode > 0o600) {
    throw new Error(`DB file permissions too permissive: ${mode.toString(8)}`);
  }
}
```

Call at server startup. Fail loud, not silent.

**Verification:**
```bash
ls -la data/copilot.db*
# Expect: -rw------- for all DB files
node -e "require('./dist/lib/verify-permissions').verifyDbPermissions('data/copilot.db')"
# Expect: no output (silent success) or thrown error
```

### 3.3 SQL injection audit

```bash
grep -rn 'sql`' src/ | grep -v node_modules
# Every match must use bound parameters, not string interpolation
```

Drizzle parameterizes by default. Risk is in raw SQL escape hatches — most likely in Phase 5 derived computations.

### 3.4 Encryption at rest — pick ONE path

The audit was right that "use SQLCipher" is hand-wavy. Real options:

**Option A (recommended for single-machine local install):** OS-level disk encryption.
- macOS: FileVault (verify: `fdesetup status`)
- Linux: LUKS on data volume
- Windows: BitLocker

This protects the DB, WAL/SHM files, backups, logs, and `.env` simultaneously. No code changes.

**Option B (for shared/multi-user hosts):** SQLCipher.
- Requires swapping `better-sqlite3` for [@journeyapps/sqlcipher](https://github.com/journeyapps/node-sqlcipher) or [@signalapp/better-sqlite3](https://github.com/signalapp/better-sqlite3) (Signal fork includes SQLCipher).
- Drizzle works with these via the same SQLite dialect.
- Key management: store passphrase in OS keychain (macOS Keychain, libsecret on Linux, Credential Manager on Windows) or in your secret manager from Layer 4. Don't put it in `.env`.

**Skip both if:** machine is single-user, full-disk encrypted, and physically secure (laptop with screen lock).

### 3.5 Redis hardening

The audit caught this gap. BullMQ stores job payloads in Redis, including UPNs for M365 fanout — that's PII at rest in Redis.

**Configuration in `redis.conf`:**
```
bind 127.0.0.1 ::1               # localhost only
protected-mode yes
requirepass <strong-random>       # set even on localhost
```

**Application connection:**
```ts
const redis = new IORedis({
  host: '127.0.0.1',
  port: 6379,
  password: env.REDIS_PASSWORD,
  enableReadyCheck: true,
});
```

**Job payload hygiene:**
- Pass user IDs, not full user objects
- Fetch sensitive data inside the job worker, not in the queued payload
- Set `removeOnComplete: { age: 86400 }` so completed jobs don't accumulate forever

**Verification:**
```bash
redis-cli -a wrong-password ping
# Expect: NOAUTH error
redis-cli -h 0.0.0.0 ping  # external interface
# Expect: connection refused
```

### 3.6 Backup security

Phase 8 mentions a backup script. Hardening additions:

```bash
#!/bin/bash
# scripts/backup.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

DATE=$(date -u +%Y-%m-%d)
BACKUP_FILE="$BACKUP_DIR/copilot-$DATE.db"

# Online backup via SQLite
sqlite3 data/copilot.db ".backup $BACKUP_FILE"
chmod 600 "$BACKUP_FILE"

# Encrypt (age is simple; gpg works too)
age -r "$(cat ~/.config/copilot-dashboard/backup.pubkey)" \
    -o "$BACKUP_FILE.age" "$BACKUP_FILE"
shred -u "$BACKUP_FILE"

# Retention: keep 30 days, securely delete older
find "$BACKUP_DIR" -name "copilot-*.db.age" -mtime +30 -exec shred -u {} \;
```

**Cost:** age encryption is fast (~50ms for typical DB size). Shred is slow on SSDs but completes async.

**Verification:**
```bash
ls -la backups/
# Expect: 700 perms on dir, 600 on files, all .age extensions, no plaintext .db
file backups/*.age
# Expect: "data" (encrypted, not recognizable as SQLite)
```

### Sources for Layer 3
- [SQLite documentation — pragma](https://sqlite.org/pragma.html) **[A]**
- [SQLite CVE database — official commentary](https://sqlite.org/cves.html) **[A]**
- [Best Practices for Securing SQLite — Blackhawk](https://blackhawk.sh/en/blog/best-practices-for-securing-sqlite/) **[O]**
- [SQLCipher documentation](https://www.zetetic.net/sqlcipher/documentation/) **[V]** (vendor of SQLCipher)
- [Redis Security documentation](https://redis.io/docs/management/security/) **[A]**
- [BullMQ Security considerations](https://docs.bullmq.io/) **[A]**
- [age encryption tool](https://github.com/FiloSottile/age) **[A]**

---

## Layer 4 — Secret Management

**Defends against:** Credential theft, accidental disclosure, secret sprawl across team
**Time:** 1 hour to baseline, 1–3 days to migrate to a secret manager

### 4.1 Baseline (do regardless of where secrets ultimately live)

```bash
# Verify .env in .gitignore
grep -E '^\.env$' .gitignore || echo '.env' >> .gitignore

# Audit git history
git log --all --full-history --source -- .env .env.local .env.production
# Any output = secrets in history = rotate them now

# Create example
cp .env .env.example
sed -i.bak 's/=.*/=/' .env.example && rm .env.example.bak
```

### 4.2 The framing on AI coding tools

Adjusting the v1 framing to remove FUD:

AI coding assistants operating in your workspace (Claude Code, Cursor, Copilot) can read `.env` contents because they have filesystem access to the workspace. The risk is **accidental disclosure** — a model including secrets in a generated response, error trace, or telemetry — not silent exfiltration. This is a real risk worth mitigating but it's not malware.

Mitigations:
- Don't keep `.env` in the project root if you use AI tools heavily; load from `~/.config/copilot-dashboard/secrets` instead
- Or use a secret manager so the file doesn't exist
- Configure tool-specific exclusions where available (Cursor `.cursorignore`, etc.)

### 4.3 Decision tree

| Situation | Recommendation | Cost |
|---|---|---|
| Solo, single machine, FDE on | `.env` with `chmod 600`, outside repo dir | Low — just discipline |
| Solo, want zero-disk | `dotenvx` (encrypted file in repo) | Low — one CLI tool |
| Small team, audit trail wanted | Self-hosted Infisical | Medium — service to maintain |
| Cloud deployment | Platform secret injection (Railway, Fly, ECS, etc.) | Low — usually built-in |
| Enterprise / compliance | Doppler or HashiCorp Vault | High — full integration |

### 4.4 Token expiry — beyond just notification

The audit was right that "wire up `notifyOps()`" is incomplete. Real coverage:

```ts
// src/services/health/credential-check.ts
export async function checkCredentialHealth(): Promise<CredentialHealth> {
  const results = await Promise.allSettled([
    fetchGithubRateLimit(),    // returns auth status + rate limit info
    fetchGraphMe(),            // cheapest authenticated Graph call
  ]);
  // Distinguish: 401 (revoked), 403 (scopes reduced), 200 (working)
  // For GitHub PAT, also check expiry header if present
}
```

Run this:
- On every server startup
- Daily via cron, separate from main pipeline
- Alert at <30 days remaining when API exposes expiry

### 4.5 Verification

```bash
# Confirm no secrets in shell history
history | grep -E '(GITHUB_TOKEN|AZURE_CLIENT_SECRET)'

# Confirm .env permissions
stat -c %a .env  # Expect: 600

# Confirm git history clean
git log --all -- .env  # Expect: no output

# Confirm credential check endpoint works
curl http://localhost:3000/api/health | jq '.credentials'
```

### Sources for Layer 4
- [12-Factor App — Config](https://12factor.net/config) **[A]**
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) **[A]**
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs) **[V]**
- [Infisical docs](https://infisical.com/docs/documentation/getting-started/introduction) **[V]**
- [dotenvx documentation](https://dotenvx.com/docs/) **[V]**
- [Should You Still Use dotenv in 2025? — Infisical](https://infisical.com/blog/stop-using-dotenv-in-nodejs-v20.6.0+) **[V]**

---

## Layer 5 — Dependency & Supply Chain

**Defends against:** Known CVEs in dependencies, typosquatting, compromised maintainers, malicious postinstall scripts
**Time:** 1 hour setup, ongoing

### 5.1 Audit policy (refined from v1)

```bash
# Production deps only — what actually runs in production
npm audit --omit=dev --audit-level=high

# Dev deps separately — informational, not blocking
npm audit --include=dev
```

**Policy:**
| Severity | Production deps | Dev deps |
|---|---|---|
| Critical | Block deploy, fix within 24h | Fix within 1 week |
| High | Block deploy, fix within 1 week | Fix within sprint |
| Moderate | Track, fix within sprint | Track |
| Low | Track quarterly | Ignore |

Document exceptions: some advisories don't apply to your usage (e.g., a CVE in a code path you don't call). Allow exceptions via `package.json`'s `overrides` or audit-resolve config, with comment explaining why.

### 5.2 Supply chain hygiene

```bash
# CI installs
npm ci                          # not npm install — uses lockfile exactly

# Disable postinstall scripts for ingest-only deploys
npm ci --ignore-scripts          # then manually run scripts you trust

# Lockfile review on PRs
# Set up a CI check that flags lockfile changes for human review
```

Consider a supply chain scanner. [Socket](https://socket.dev) catches things `npm audit` doesn't (typosquats, install-time behavior, suspicious permissions). [Snyk](https://snyk.io) does similar.

**Cost:** Most scanners have a free tier for solo/small projects. CI integration is ~30 min.

### 5.3 Node.js version

```bash
node --version  # confirm LTS line (22.x at time of writing, check current)
```

Pin in `package.json`:
```json
"engines": { "node": ">=22.0.0 <23.0.0" }
```

Subscribe to [Node.js security advisories](https://nodejs.org/en/blog/vulnerability) (RSS available).

**Verification:**
```bash
npm audit --omit=dev --audit-level=high
# Expect: 0 vulnerabilities, or known/documented exceptions only

cat package.json | jq '.engines.node'
# Expect: explicit version range pinned to LTS
```

### Sources for Layer 5
- [npm audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit) **[A]**
- [Node.js Security Releases blog](https://nodejs.org/en/blog/vulnerability) **[A]**
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/) **[A]**
- [GitHub — npm supply chain security](https://docs.github.com/en/code-security/supply-chain-security) **[A]**
- [Socket.dev](https://socket.dev) **[V]**

---

## Layer 6 — Information Leakage

**Defends against:** Secret/PII disclosure via logs, errors, and operational endpoints
**Time:** 2–3 hours

### 6.1 Pino redaction (with comprehensive paths)

```ts
import pino from 'pino';

export const logger = pino({
  redact: {
    paths: [
      // Headers
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["x-auth-token"]',
      'res.headers["set-cookie"]',
      // Body
      'body.password',
      'body.token',
      'body.clientSecret',
      'body.apiKey',
      // Query strings (some integrations put tokens here)
      'req.query.token',
      'req.query.access_token',
      // HTTP client errors often attach full request config
      'err.config.headers.authorization',
      'err.config.auth',
      'err.request.headers.authorization',
      // Drizzle debug output
      '*.parameters',  // adjust to match Drizzle's actual log shape
    ],
    censor: '[REDACTED]',
  },
});
```

Pino redact paths use [fast-redact syntax](https://github.com/davidmarkclements/fast-redact). Forgotten paths silently do nothing — must test.

**Verification (must be a real test, not eyeballing):**
```ts
// tests/security/log-redaction.test.ts
test('redacts authorization header', () => {
  const captured: string[] = [];
  const testLogger = pino({ redact: redactConfig }, { write: (msg) => captured.push(msg) });
  testLogger.info({ req: { headers: { authorization: 'Bearer ghp_secret123' } } });
  expect(captured.join('')).not.toContain('ghp_secret123');
  expect(captured.join('')).toContain('[REDACTED]');
});
```

Run a regex sweep over production logs as a smoke test:
```bash
grep -rE '(ghp_|gho_|ghu_|ghs_|github_pat_)[A-Za-z0-9_]{20,}' logs/
# Expect: no matches
```

### 6.2 Error handler with allowlist

```ts
import { ZodError } from 'zod';

const SAFE_ERROR_CLASSES = new Set([
  'ValidationError',
  'NotFoundError',
  'RateLimitError',
]);

fastify.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, 'request error');

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'Validation failed',
      issues: error.issues.map(i => ({ path: i.path, message: i.message })),
    });
  }

  if (SAFE_ERROR_CLASSES.has(error.constructor.name)) {
    return reply.status(error.statusCode ?? 400).send({
      error: error.message,
    });
  }

  // Unknown errors: never leak details
  return reply.status(500).send({
    error: 'Internal Server Error',
    requestId: request.id,
  });
});
```

### 6.3 Operational endpoint access control

`/api/admin/*`, `/api/meta/*` return internal data. Even without authentication, restrict at the network layer:

```ts
// src/api/middleware/internal-only.ts
export async function internalOnly(request: FastifyRequest, reply: FastifyReply) {
  const ip = request.ip;
  const allowed = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  if (!allowed.includes(ip) && !ip.startsWith('10.') && !ip.startsWith('192.168.')) {
    return reply.status(404).send();  // 404, not 403 — don't confirm endpoint exists
  }
}

// Apply to admin/meta routes
fastify.register(adminRoutes, { preHandler: internalOnly });
```

**Cost:** Adds an IP check per request. Negligible. Caveat: if behind a reverse proxy, configure `trustProxy` correctly so `request.ip` reflects the real client.

**Verification:**
```bash
# From localhost
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/pipelines/runs
# Expect: 200

# Simulate external IP (if behind proxy)
curl -H "X-Forwarded-For: 8.8.8.8" -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/pipelines/runs
# Expect: 404
```

### Sources for Layer 6
- [Pino logging documentation — redaction](https://github.com/pinojs/pino/blob/main/docs/redaction.md) **[A]**
- [fast-redact paths syntax](https://github.com/davidmarkclements/fast-redact) **[A]**
- [Fastify error handling](https://fastify.dev/docs/latest/Reference/Errors/) **[A]**
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) **[A]**

---

## Layer 7 — Security Regression Testing

**Defends against:** Future changes silently undoing security controls
**Time:** 1 day initial setup, ongoing maintenance

This layer is new in v2. Without it, every other layer is one careless commit away from regression.

### 7.1 Test directory structure

```
tests/security/
  headers.test.ts          # asserts Helmet output
  rate-limit.test.ts       # asserts 429 after threshold
  redaction.test.ts        # asserts log redaction works
  error-handler.test.ts    # asserts no stack trace leakage
  ssrf.test.ts             # asserts URL allowlist enforced
  permissions.test.ts      # asserts file mode checks
  injection.test.ts        # asserts parameterization (run a few real attack strings)
  cors.test.ts             # asserts origin allowlist
```

### 7.2 Example tests

```ts
// tests/security/headers.test.ts
test('responses include security headers', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/health' });
  expect(res.headers['strict-transport-security']).toBeDefined();
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['x-frame-options']).toBe('DENY');
  expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
});

// tests/security/error-handler.test.ts
test('500 errors do not leak stack traces', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/route-that-throws' });
  expect(res.statusCode).toBe(500);
  expect(res.body).not.toMatch(/at \w+\.\w+ \(/); // no stack frames
  expect(res.body).not.toContain('node_modules');
});

// tests/security/ssrf.test.ts
test('NDJSON fetcher rejects non-allowlisted hosts', () => {
  expect(() => assertSafeUrl('https://evil.com/data.ndjson')).toThrow();
  expect(() => assertSafeUrl('http://api.github.com/data')).toThrow();  // not HTTPS
  expect(() => assertSafeUrl('https://objects.githubusercontent.com/x')).not.toThrow();
});
```

### 7.3 CI integration

```yaml
# .github/workflows/security.yml
- name: Security tests
  run: npm test -- tests/security
- name: Audit production deps
  run: npm audit --omit=dev --audit-level=high
- name: Log redaction smoke test
  run: |
    npm run start:test &
    sleep 3
    curl -X POST http://localhost:3000/api/admin/test-log
    grep -rE '(ghp_|gho_)[A-Za-z0-9_]+' logs/ && exit 1 || exit 0
```

### Sources for Layer 7
- [OWASP DevSecOps Guideline](https://owasp.org/www-project-devsecops-guideline/) **[A]**
- [Fastify testing docs — inject](https://fastify.dev/docs/latest/Guides/Testing/) **[A]**

---

## Ongoing Practice (Operationalized)

The audit was right that "review weekly" without ownership doesn't happen. Operationalize.

### Calendar-based reminders

Add to whatever you use for recurring tasks (calendar, reminders, project management):

| Item | Cadence | Action |
|---|---|---|
| Run `npm audit --omit=dev` | Every deploy | Block on high+ |
| Check pipeline_runs for failures | Weekly | If any failed runs in last 7d, investigate |
| Review api_drift_log entries | Monthly | Resolve or document each entry |
| Token rotation: GitHub PAT | Set reminder when token created | Rotate before expiry |
| Token rotation: Azure secret | Set reminder when secret created | Rotate before expiry |
| Node.js LTS check | Quarterly | Update if current LTS released a new minor |
| Full dependency review | Quarterly | Major version bumps, drop unused |
| Backup restore drill | Quarterly | Restore latest backup to test instance, verify |

### Runbook

Create `docs/SECURITY_RUNBOOK.md` covering:
- Token rotation procedures (step-by-step for both GitHub and Azure)
- Incident response: what to do if a token is suspected compromised
- How to read `api_drift_log` and what to do about entries
- How to verify health check output
- Emergency contacts (security@yourorg, on-call rotation if any)

A runbook nobody reads is still better than no runbook. The act of writing it surfaces gaps.

---

## Action List — Sequenced and Time-Boxed

Realistic estimates, in order. Total is roughly 3–5 working days of focused work, not "one day."

### Day 1 — Quick wins (4–6 hours)
- [ ] `npm audit --omit=dev --audit-level=high` — establish baseline, fix highs
- [ ] Add `.env` to `.gitignore`, scan history with `git log --all --full-history -- .env`
- [ ] Create `.env.example`, commit it
- [ ] Pin Node.js LTS in `engines`
- [ ] Set DB file permissions, add startup verification check
- [ ] Subscribe to Node.js security advisories

### Day 2 — HTTP layer (4–6 hours)
- [ ] Install and configure `@fastify/helmet` (budget time for CSP debugging)
- [ ] Install `@fastify/rate-limit`, configure global + admin tiers
- [ ] Configure `@fastify/cors` with explicit origin allowlist
- [ ] Implement `assertSafeUrl()` for SSRF protection on NDJSON fetcher
- [ ] Write security tests for headers, rate limit, CORS, SSRF

### Day 3 — Database & Redis (4–6 hours)
- [ ] Set SQLite PRAGMAs (decide on `secure_delete` based on threat model)
- [ ] Audit raw SQL: `grep -rn 'sql\`' src/`, verify parameterization
- [ ] Configure Redis: bind localhost, set password, application uses password
- [ ] Audit BullMQ job payloads — replace any embedded sensitive data with IDs
- [ ] Decide and implement encryption-at-rest path (FDE vs SQLCipher)
- [ ] Update backup script with encryption + retention + secure delete

### Day 4 — Information leakage (4–6 hours)
- [ ] Pino redact configuration with comprehensive path list
- [ ] Production error handler with class allowlist
- [ ] Internal-only middleware on `/api/admin/*` and `/api/meta/*`
- [ ] Write tests for redaction, error handler, internal-only enforcement
- [ ] Run regex sweep on existing logs for any leaked tokens

### Day 5 — Operationalize (3–4 hours)
- [ ] Wire up `notifyOps()` end-to-end (test with simulated 401)
- [ ] Implement credential health check service
- [ ] Decide on secret management migration path (or document why staying on `.env` is acceptable for current threat model)
- [ ] Write `docs/SECURITY_RUNBOOK.md`
- [ ] Set calendar reminders for token rotations and recurring practice
- [ ] Set up CI security workflow

### Optional / longer projects
- [ ] Migrate to a secret manager (1–3 days)
- [ ] Set up Socket or Snyk supply chain scanning (half day)
- [ ] Deploy behind a reverse proxy with TLS termination if currently bare (1–2 days)

---

## What This Plan Does NOT Cover

Explicit scope boundaries to avoid false security:

- **Authentication/authorization** — separate plan needed if dashboard ever gets multi-user
- **Network perimeter** — assumes deployment env handles ingress filtering
- **Host OS hardening** — beyond file perms and non-root execution
- **Physical security** — laptop encryption (FileVault etc.) is your responsibility
- **Insider threat** — Zack having access to all the data is by design; controls don't address malicious authorized users
- **Compliance frameworks** — SOC2, ISO 27001, GDPR, etc. require additional controls beyond what's here

---

## Threat Coverage Matrix

| Threat (from model) | Layers addressing it | Residual risk |
|---|---|---|
| Credential theft from disk/memory | 3.4, 4.1, 4.3, 6.1 | Memory dumps not addressed |
| Data exfiltration | 1.1, 1.4, 3.1, 3.2, 6.3 | Authorized access leakage out of scope |
| Supply chain compromise | 5.1, 5.2 | Zero-day in maintained dep is unmitigated |
| Lateral movement from dev machine | 3.4 (FDE), 4.4 (cred health), 6.3 | If laptop is compromised + unlocked, app data is exposed |
| Denial of service | 1.2, 2.1 | Resource-level attacks (Redis, DB) limited mitigation |

---

## Complete Source List

### Authoritative [A]
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) — Input Validation, SSRF, Logging, Secrets Management, DevSecOps
- [Node.js Security Releases](https://nodejs.org/en/blog/vulnerability)
- [Fastify documentation](https://fastify.dev/docs/) — Validation, Errors, Testing, LTS
- [SQLite documentation](https://sqlite.org/) — pragma, CVE commentary
- [Redis Security documentation](https://redis.io/docs/management/security/)
- [BullMQ documentation](https://docs.bullmq.io/)
- [Pino documentation](https://github.com/pinojs/pino) — redaction, fast-redact
- [Zod documentation](https://zod.dev/)
- [npm audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [GitHub supply chain security](https://docs.github.com/en/code-security/supply-chain-security)
- [12-Factor App — Config](https://12factor.net/config)
- [age encryption](https://github.com/FiloSottile/age)
- [Helmet.js documentation](https://helmetjs.github.io/)

### Vendor [V]
- [Infisical](https://infisical.com) — secret management platform
- [HashiCorp Vault](https://developer.hashicorp.com/vault/docs) — enterprise secret management
- [dotenvx](https://dotenvx.com/docs/) — encrypted .env files
- [SQLCipher](https://www.zetetic.net/sqlcipher/documentation/) — SQLite encryption
- [Socket.dev](https://socket.dev) — supply chain scanner
- [Snyk](https://security.snyk.io) — vulnerability scanner

### Opinion [O]
- [Best Practices for Securing SQLite — Blackhawk](https://blackhawk.sh/en/blog/best-practices-for-securing-sqlite/)
- [Better Stack — Securing Node.js Applications](https://betterstack.com/community/guides/scaling-nodejs/securing-nodejs-applications/)
- [Hardening Node.js Apps in Production — SitePoint](https://www.sitepoint.com/hardening-node-js-apps-in-production/)
- [Node.js Security Hardening — DEV Community](https://dev.to/axiom_agent/nodejs-security-hardening-in-production-owasp-top-10-implementation-guide-5ff4)

### Excluded from v2 (low quality or vendor-conflicted on key claims)
The v1 plan cited several sources that primarily promote products (Keyway, StackHawk, certain Snyk content). v2 retains them only where they provide unique technical content not available in authoritative sources.
