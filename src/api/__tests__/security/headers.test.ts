import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../../db/schema/index.js';
import { buildServer } from '../../server.js';

process.env.LOG_LEVEL = 'silent';

const testSqlite = new Database(':memory:');
const testDb = drizzle(testSqlite, { schema });
let server: Awaited<ReturnType<typeof buildServer>>;

beforeAll(async () => {
  migrate(testDb, { migrationsFolder: './drizzle' });
  server = await buildServer({ db: testDb });
  await server.ready();
});

afterAll(async () => {
  await server.close();
  testSqlite.close();
});

describe('security headers (Helmet)', () => {
  it('sets x-content-type-options: nosniff', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets x-frame-options: SAMEORIGIN', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('sets content-security-policy with default-src self', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
  });

  it('sets content-security-policy with frame-ancestors none', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
  });

  it('does not set strict-transport-security in dev', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('CORS', () => {
  it('rejects requests from unknown origin', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/health',
      headers: { Origin: 'https://evil.com' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows requests from Vite dev origin', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/health',
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
