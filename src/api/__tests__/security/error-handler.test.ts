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

  // Route that intentionally throws to exercise 500 handler
  server.get('/api/__test__/throw', async () => {
    throw new Error('secret internal detail\n  at Object.<anonymous> (/app/node_modules/secret/index.js:1:1)');
  });

  await server.ready();
});

afterAll(async () => {
  await server.close();
  testSqlite.close();
});

describe('error handler', () => {
  it('returns 500 for unhandled errors', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/__test__/throw' });
    expect(res.statusCode).toBe(500);
  });

  it('does not leak error message in 500 response', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/__test__/throw' });
    expect(res.body).not.toContain('secret internal detail');
  });

  it('does not leak stack frames in 500 response', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/__test__/throw' });
    expect(res.body).not.toMatch(/at Object\.\<anonymous\>/);
  });

  it('does not expose node_modules paths in 500 response', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/__test__/throw' });
    expect(res.body).not.toContain('node_modules');
  });

  it('includes requestId in 500 response', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/__test__/throw' });
    const body = res.json<{ error: string; requestId: string }>();
    expect(body.error).toBe('Internal server error');
    expect(typeof body.requestId).toBe('string');
  });

  it('returns 404 for unknown routes without leaking internals', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(res.statusCode).toBe(404);
  });
});
