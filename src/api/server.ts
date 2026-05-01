import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from '../config/env.js';

export async function buildServer() {
  const server = Fastify({ logger: { level: env.LOG_LEVEL } });

  await server.register(cors);

  server.get('/api/health', async () => {
    return { ok: true, ts: Date.now() };
  });

  return server;
}
