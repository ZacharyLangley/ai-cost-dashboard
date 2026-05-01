/**
 * Smoke test — run after deploy to verify all routes respond.
 * Usage: tsx scripts/smoke-test.ts [base_url]
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';

interface Check {
  method: 'GET' | 'POST';
  path: string;
  expectStatus?: number;
  expectNonEmpty?: boolean;
}

const checks: Check[] = [
  { method: 'GET', path: '/api/health', expectStatus: 200 },
  { method: 'GET', path: '/api/org/summary', expectNonEmpty: true },
  { method: 'GET', path: '/api/org/idle-seats' },
  { method: 'GET', path: '/api/org/trend' },
  { method: 'GET', path: '/api/developers' },
  { method: 'GET', path: '/api/teams' },
  { method: 'GET', path: '/api/products/github/models' },
  { method: 'GET', path: '/api/products/github/acceptance-vs-cost' },
  { method: 'GET', path: '/api/products/m365/adoption-heatmap' },
  { method: 'GET', path: '/api/products/m365/breadth' },
  { method: 'GET', path: '/api/meta/pipeline-status' },
  { method: 'GET', path: '/api/meta/hashing-status' },
];

let passed = 0;
let failed = 0;

for (const check of checks) {
  try {
    const res = await fetch(`${BASE}${check.path}`, { method: check.method });
    const expectedStatus = check.expectStatus ?? 200;

    if (res.status !== expectedStatus) {
      console.error(`FAIL ${check.method} ${check.path} — expected ${expectedStatus}, got ${res.status}`);
      failed++;
      continue;
    }

    if (check.expectNonEmpty) {
      const body = await res.json();
      if (body === null || (Array.isArray(body) && body.length === 0)) {
        console.warn(`WARN ${check.method} ${check.path} — empty response`);
      }
    }

    console.log(`PASS ${check.method} ${check.path}`);
    passed++;
  } catch (err) {
    console.error(`FAIL ${check.method} ${check.path} — ${err}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
