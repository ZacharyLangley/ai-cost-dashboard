import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import * as schema from '../../../db/schema/index.js';
import { apiDriftLog, ghUsageFacts, ghSeats } from '../../../db/schema/index.js';

// Mock env before importing pipeline modules
vi.mock('../../../config/env.js', () => ({
  env: {
    GITHUB_TOKEN: 'test-token',
    GITHUB_ORG: 'test-org',
    GITHUB_ENTERPRISE: '',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'file:./data/copilot.db',
    REDIS_URL: 'redis://localhost:6379',
    GH_SEAT_COST_USD: 19,
    M365_SEAT_COST_USD: 30,
    PORT: 3000,
    AZURE_TENANT_ID: '',
    AZURE_CLIENT_ID: '',
    AZURE_CLIENT_SECRET: '',
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// In-memory DB shared across tests; tables cleared in beforeEach
const testSqlite = new Database(':memory:');
testSqlite.pragma('journal_mode = WAL');
const testDb = drizzle(testSqlite, { schema });

// Lazy imports after mocks are set up
const { ingestUsage } = await import('../ingest-usage.js');
const { ingestSeats } = await import('../ingest-seats.js');
const { fetchAllSeats } = await import('../../../services/github/seats.js');

beforeAll(() => {
  migrate(testDb, { migrationsFolder: './drizzle' });
});

beforeEach(() => {
  testSqlite.exec('DELETE FROM gh_usage_facts');
  testSqlite.exec('DELETE FROM raw_gh_usage');
  testSqlite.exec('DELETE FROM api_drift_log');
  testSqlite.exec('DELETE FROM gh_seats');
  testSqlite.exec('DELETE FROM pipeline_runs');
  vi.stubGlobal('fetch', vi.fn());
});

// ── helpers ──────────────────────────────────────────────────────────────────

function mockJsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  const h = new Headers(headers);
  return {
    ok: true,
    status: 200,
    headers: h,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    body: null,
  } as unknown as Response;
}

const baseUsageItem = {
  user: 'alice',
  product: 'Copilot',
  sku: 'Copilot Premium Request',
  model: 'claude-sonnet-4-6',
  unitType: 'requests',
  pricePerUnit: 0.04,
  grossQuantity: 100,
  grossAmount: 4.0,
  discountQuantity: 0,
  discountAmount: 0.0,
  netQuantity: 100,
  netAmount: 4.0,
};

const baseSeat = {
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  last_activity_at: '2024-04-01T00:00:00Z',
  last_activity_editor: 'vscode',
  plan_type: 'business',
  assignee: { login: 'alice' },
};

// ── usage idempotency ─────────────────────────────────────────────────────────

describe('ingestUsage', () => {
  it('inserts usage facts', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(mockJsonResponse({ usageItems: [baseUsageItem] }));

    await ingestUsage(testDb);

    const [{ count }] = await testDb
      .select({ count: sql<number>`count(*)` })
      .from(ghUsageFacts);
    expect(count).toBe(2); // current + previous month, same item shape
  });

  it('is idempotent — second run does not add rows', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(mockJsonResponse({ usageItems: [baseUsageItem] }));

    await ingestUsage(testDb);
    const [{ count: before }] = await testDb
      .select({ count: sql<number>`count(*)` })
      .from(ghUsageFacts);

    // Reset mocks but return same data
    mockFetch.mockResolvedValue(mockJsonResponse({ usageItems: [baseUsageItem] }));
    await ingestUsage(testDb);
    const [{ count: after }] = await testDb
      .select({ count: sql<number>`count(*)` })
      .from(ghUsageFacts);

    expect(before).toBe(after);
  });

  it('logs unknown unitType to api_drift_log and still inserts row', async () => {
    const mockFetch = vi.mocked(fetch);
    const unknownItem = { ...baseUsageItem, unitType: 'ai_credits_xyz' };
    mockFetch.mockResolvedValue(mockJsonResponse({ usageItems: [unknownItem] }));

    await ingestUsage(testDb);

    const driftRows = await testDb.select().from(apiDriftLog);
    expect(driftRows.length).toBeGreaterThan(0);
    expect(driftRows.some((r) => r.fieldPath === 'unitType')).toBe(true);
    expect(driftRows.some((r) => r.unexpectedValue === 'ai_credits_xyz')).toBe(true);

    // Row still inserted despite unknown unitType
    const [{ count }] = await testDb
      .select({ count: sql<number>`count(*)` })
      .from(ghUsageFacts);
    expect(count).toBeGreaterThan(0);
  });
});

// ── seats pagination ──────────────────────────────────────────────────────────

describe('fetchAllSeats', () => {
  it('follows Link rel=next to fetch all pages', async () => {
    const mockFetch = vi.mocked(fetch);

    const seat2 = { ...baseSeat, assignee: { login: 'bob' } };
    mockFetch
      .mockResolvedValueOnce(
        mockJsonResponse(
          { total_seats: 2, seats: [baseSeat] },
          {
            Link: '<https://api.github.com/orgs/test-org/copilot/billing/seats?page=2>; rel="next"',
          },
        ),
      )
      .mockResolvedValueOnce(mockJsonResponse({ total_seats: 2, seats: [seat2] }));

    const seats = await fetchAllSeats('test-org');

    expect(seats).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(seats.map((s) => s.assignee.login)).toEqual(['alice', 'bob']);
  });
});

// ── seats ingest idempotency ──────────────────────────────────────────────────

describe('ingestSeats', () => {
  it('is idempotent', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(mockJsonResponse({ total_seats: 1, seats: [baseSeat] }));

    await ingestSeats(testDb);
    const [{ count: before }] = await testDb
      .select({ count: sql<number>`count(*)` })
      .from(ghSeats);

    mockFetch.mockResolvedValue(mockJsonResponse({ total_seats: 1, seats: [baseSeat] }));
    await ingestSeats(testDb);
    const [{ count: after }] = await testDb
      .select({ count: sql<number>`count(*)` })
      .from(ghSeats);

    expect(before).toBe(after);
  });
});
