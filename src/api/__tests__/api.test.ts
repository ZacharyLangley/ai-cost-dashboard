import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema/index.js';
import {
  ghUsageFacts,
  ghSeats,
  ghMetricsDaily,
  m365UsageFacts,
  m365AppActivity,
  identityMap,
  pipelineRuns,
} from '../../db/schema/index.js';
import { buildServer } from '../server.js';

// Suppress Fastify logs in tests
process.env.LOG_LEVEL = 'silent';

const testSqlite = new Database(':memory:');
const testDb = drizzle(testSqlite, { schema });
let server: Awaited<ReturnType<typeof buildServer>>;

const TEST_MONTH = '2025-01';
const TEST_PULL_DATE = '2025-01-15';
const TEST_SNAP_DATE = '2025-01-15';

beforeAll(async () => {
  migrate(testDb, { migrationsFolder: './drizzle' });

  // Identity
  await testDb.insert(identityMap).values([
    { ghUsername: 'alice', m365Upn: 'alice@co.com', displayName: 'Alice', team: 'Platform' },
    { ghUsername: 'bob', m365Upn: 'bob@co.com', displayName: 'Bob', team: 'Frontend' },
  ]);

  // GH usage
  await testDb.insert(ghUsageFacts).values([
    {
      billingMonth: TEST_MONTH, username: 'alice', product: 'Copilot',
      sku: 'Copilot Premium Request', model: 'claude-sonnet-4-6', unitType: 'requests',
      pricePerUnit: 0.04, grossQty: 100, grossAmount: 4, discountQty: 0, discountAmount: 0,
      netQty: 100, netAmount: 4, pulledAt: TEST_PULL_DATE,
    },
    {
      billingMonth: TEST_MONTH, username: 'bob', product: 'Copilot',
      sku: 'Copilot Premium Request', model: 'gpt-4o', unitType: 'requests',
      pricePerUnit: 0.05, grossQty: 50, grossAmount: 2.5, discountQty: 0, discountAmount: 0,
      netQty: 50, netAmount: 2.5, pulledAt: TEST_PULL_DATE,
    },
  ]);

  // GH seats (alice active, bob idle)
  await testDb.insert(ghSeats).values([
    { snapshotDate: TEST_SNAP_DATE, username: 'alice', planType: 'business', seatCostUsd: 19, lastActivityAt: new Date().toISOString() },
    { snapshotDate: TEST_SNAP_DATE, username: 'bob', planType: 'business', seatCostUsd: 19, lastActivityAt: '2020-01-01T00:00:00Z' },
  ]);

  // GH metrics
  await testDb.insert(ghMetricsDaily).values([
    { metricDate: '2025-01-10', username: 'alice', ide: 'vscode', feature: 'completions', suggestions: 100, acceptances: 40 },
    { metricDate: '2025-01-10', username: 'bob', ide: 'vscode', feature: 'completions', suggestions: 50, acceptances: 10 },
  ]);

  // M365
  await testDb.insert(m365UsageFacts).values([
    { pullDate: TEST_PULL_DATE, upn: 'alice@co.com', upnIsHashed: false, displayName: 'Alice', lastActivity: '2025-01-14', daysSinceActive: 1, seatSku: 'M365 Copilot', seatCostUsd: 30 },
    { pullDate: TEST_PULL_DATE, upn: 'bob@co.com', upnIsHashed: false, displayName: 'Bob', lastActivity: '2024-10-01', daysSinceActive: 106, seatSku: 'M365 Copilot', seatCostUsd: 30 },
  ]);

  await testDb.insert(m365AppActivity).values([
    { pullDate: TEST_PULL_DATE, upn: 'alice@co.com', app: 'teams', lastActive: '2025-01-14' },
    { pullDate: TEST_PULL_DATE, upn: 'alice@co.com', app: 'word', lastActive: '2025-01-10' },
    { pullDate: TEST_PULL_DATE, upn: 'bob@co.com', app: 'outlook', lastActive: '2024-10-01' },
  ]);

  // Pipeline run
  await testDb.insert(pipelineRuns).values({
    pipeline: 'github', startedAt: '2025-01-15T10:00:00Z', finishedAt: '2025-01-15T10:00:05Z', status: 'success', rowsAffected: 10,
  });

  server = await buildServer({ db: testDb });
  await server.ready();
});

afterAll(async () => {
  await server.close();
  testSqlite.close();
});

// ── /api/developers ───────────────────────────────────────────────────────────

describe('GET /api/developers', () => {
  it('returns developers for a month', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/developers?month=${TEST_MONTH}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ username: string }[]>();
    expect(body.length).toBe(2);
    expect(body.map((d) => d.username)).toContain('alice');
  });

  it('returns empty array for month with no data', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/developers?month=2099-01' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns 400 for invalid month format', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/developers?month=January' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid sort value', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/developers?sort=invalid' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/developers/:username', () => {
  it('returns developer detail', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/developers/alice' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ identity: { displayName: string }; modelMix: unknown[] }>();
    expect(body.identity.displayName).toBe('Alice');
    expect(Array.isArray(body.modelMix)).toBe(true);
  });

  it('returns 404 for unknown developer', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/developers/nobody' });
    expect(res.statusCode).toBe(404);
  });
});

// ── /api/teams ────────────────────────────────────────────────────────────────

describe('GET /api/teams', () => {
  it('returns teams for a month', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/teams?month=${TEST_MONTH}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ team: string }[]>();
    expect(body.length).toBeGreaterThan(0);
    expect(body.some((t) => t.team === 'Platform')).toBe(true);
  });
});

describe('GET /api/teams/:teamName', () => {
  it('returns team detail', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/teams/Platform' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ monthly: unknown[]; developers: unknown[] }>();
    expect(Array.isArray(body.monthly)).toBe(true);
    expect(Array.isArray(body.developers)).toBe(true);
  });

  it('returns 404 for unknown team', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/teams/NoSuchTeam' });
    expect(res.statusCode).toBe(404);
  });
});

// ── /api/org ──────────────────────────────────────────────────────────────────

describe('GET /api/org/summary', () => {
  it('returns org summary', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/org/summary' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ breakdown: { ghUsage: number }; idleSeats: { github: number } }>();
    expect(typeof body.breakdown.ghUsage).toBe('number');
    expect(body.idleSeats.github).toBeGreaterThan(0); // bob is idle
  });
});

describe('GET /api/org/idle-seats', () => {
  it('returns idle seats', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/org/idle-seats' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ username: string }[]>();
    expect(body.some((s) => s.username === 'bob')).toBe(true);
  });

  it('filters by product', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/org/idle-seats?product=github' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ product: string }[]>();
    expect(body.every((s) => s.product === 'github')).toBe(true);
  });

  it('returns 400 for invalid product', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/org/idle-seats?product=slack' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/org/trend', () => {
  it('returns trend data', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/org/trend?months=3' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

// ── /api/products ─────────────────────────────────────────────────────────────

describe('GET /api/products/github/models', () => {
  it('returns model breakdown', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/products/github/models?month=${TEST_MONTH}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ model: string }[]>();
    expect(body.some((m) => m.model === 'claude-sonnet-4-6')).toBe(true);
  });
});

describe('GET /api/products/github/acceptance-vs-cost', () => {
  it('returns acceptance vs cost data', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/products/github/acceptance-vs-cost?month=${TEST_MONTH}` });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe('GET /api/products/m365/adoption-heatmap', () => {
  it('returns heatmap data', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/products/m365/adoption-heatmap' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ apps: Record<string, string | null> }[]>();
    expect(body.length).toBe(2);
    expect(body[0].apps).toHaveProperty('teams');
  });
});

describe('GET /api/products/m365/breadth', () => {
  it('returns breadth sorted by app count desc', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/products/m365/breadth' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ appCount: number }[]>();
    expect(body[0].appCount).toBeGreaterThanOrEqual(body[1]?.appCount ?? 0);
  });
});

// ── /api/meta ─────────────────────────────────────────────────────────────────

describe('GET /api/meta/pipeline-status', () => {
  it('returns pipeline status', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/meta/pipeline-status' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ pipeline: string }[]>();
    expect(body.some((p) => p.pipeline === 'github')).toBe(true);
  });
});

describe('GET /api/meta/hashing-status', () => {
  it('returns hashing status', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/meta/hashing-status' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ m365UpnHashed: boolean }>();
    expect(typeof body.m365UpnHashed).toBe('boolean');
  });
});
