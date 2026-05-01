import path from 'path';
import { fileURLToPath } from 'url';
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import staticPlugin from '@fastify/static';
import { ZodError } from 'zod';
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

const INTERNAL_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

async function internalOnly(request: FastifyRequest, reply: FastifyReply) {
  if (!INTERNAL_IPS.includes(request.ip)) {
    // 404 rather than 403 — don't confirm endpoint exists to external callers
    return reply.status(404).send();
  }
}

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
    await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
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

  await server.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // Only send HSTS in production — sticky HSTS on localhost breaks dev tooling
    hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  });

  await server.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '15 minutes',
  });

  // In production the frontend is same-origin (served by this server), so no CORS needed.
  // In dev the Vite dev server runs on 5173 and needs explicit permission.
  await server.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    maxAge: 86400,
  });

  server.setErrorHandler((err: Error & { statusCode?: number }, request: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof NotFoundError) {
      return reply.code(404).send({ error: err.message });
    }
    if (err instanceof ValidationError) {
      return reply.code(400).send({ error: err.message, details: err.details });
    }
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: 'Validation failed',
        issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    }
    server.log.error(err);
    // Never leak stack traces or internal details to clients
    return reply.code(500).send({ error: 'Internal server error', requestId: request.id });
  });

  server.get('/api/health', async (_req, reply) => {
    const health = await checkHealth(db);
    return reply.code(health.ok ? 200 : 503).send(health);
  });

  await server.register(developerRoutes, { db });
  await server.register(teamRoutes, { db });
  await server.register(orgRoutes, { db });
  await server.register(productRoutes, { db });

  // Admin and meta routes are internal-only — restricted to localhost IPs
  await server.register(async (scope) => {
    scope.addHook('preHandler', internalOnly);
    await scope.register(adminRoutes, { db });
    await scope.register(metaRoutes, { db });
  });

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
