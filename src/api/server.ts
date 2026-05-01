import path from 'path';
import { fileURLToPath } from 'url';
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import { sql } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db as defaultDb } from '../db/client.js';
import type { DrizzleDb } from '../db/client.js';
import { redis } from '../lib/redis.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { pipelineRuns } from '../db/schema/index.js';
import { adminRoutes } from './routes/admin.js';
import { developerRoutes } from './routes/developers.js';
import { teamRoutes } from './routes/teams.js';
import { orgRoutes } from './routes/org.js';
import { productRoutes } from './routes/products.js';
import { metaRoutes } from './routes/meta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000;

async function checkHealth(db: DrizzleDb) {
  const now = Date.now();

  // DB ping
  let dbOk = false;
  let dbLatencyMs = 0;
  try {
    const t0 = Date.now();
    db.run(sql`SELECT 1`);
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch {}

  // Redis ping
  let redisOk = false;
  let redisLatencyMs = 0;
  try {
    const t0 = Date.now();
    await redis.ping();
    redisLatencyMs = Date.now() - t0;
    redisOk = true;
  } catch {}

  // Pipeline staleness
  const allRuns = await db.select().from(pipelineRuns).orderBy(sql`${pipelineRuns.id} DESC`).limit(100);
  const latestSuccess = new Map<string, string>();
  for (const r of allRuns) {
    if (r.status === 'success' && !latestSuccess.has(r.pipeline)) {
      latestSuccess.set(r.pipeline, r.finishedAt ?? r.startedAt);
    }
  }

  const pipelines = ['github', 'm365'];
  const pipelineStatus: Record<string, { status: string; ago: string }> = {};
  const stalePipelines: string[] = [];

  for (const p of pipelines) {
    const lastSuccess = latestSuccess.get(p);
    if (!lastSuccess) {
      pipelineStatus[p] = { status: 'never_run', ago: 'never' };
      stalePipelines.push(p);
    } else {
      const ageMs = now - new Date(lastSuccess).getTime();
      const agoH = Math.floor(ageMs / 3_600_000);
      pipelineStatus[p] = {
        status: ageMs > STALE_THRESHOLD_MS ? 'stale' : 'ok',
        ago: agoH < 1 ? '<1h' : `${agoH}h`,
      };
      if (ageMs > STALE_THRESHOLD_MS) stalePipelines.push(p);
    }
  }

  const ok = dbOk && stalePipelines.length === 0;
  return {
    ok,
    ts: now,
    db: { ok: dbOk, latencyMs: dbLatencyMs },
    redis: { ok: redisOk, latencyMs: redisLatencyMs },
    lastPipelineRun: pipelineStatus,
    stalePipelines,
  };
}

export async function buildServer(opts: { db?: DrizzleDb } = {}) {
  const db = opts.db ?? defaultDb;
  const server = Fastify({ logger: { level: env.LOG_LEVEL } });

  await server.register(cors);

  server.setErrorHandler((err: Error, _req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof NotFoundError) {
      return reply.code(404).send({ error: err.message });
    }
    if (err instanceof ValidationError) {
      return reply.code(400).send({ error: err.message, details: err.details });
    }
    server.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  server.get('/api/health', async (_req, reply) => {
    const health = await checkHealth(db);
    return reply.code(health.ok ? 200 : 503).send(health);
  });

  await server.register(adminRoutes, { db });
  await server.register(developerRoutes, { db });
  await server.register(teamRoutes, { db });
  await server.register(orgRoutes, { db });
  await server.register(productRoutes, { db });
  await server.register(metaRoutes, { db });

  // Serve frontend in production
  if (env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, '../../web/dist');
    await server.register(staticPlugin, { root: distPath, prefix: '/' });
    server.setNotFoundHandler((_req, reply) => {
      void reply.sendFile('index.html');
    });
  }

  return server;
}
