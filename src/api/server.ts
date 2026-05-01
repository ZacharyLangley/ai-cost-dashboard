import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from '../config/env.js';
import { adminRoutes } from './routes/admin.js';

export async function buildServer() {
  const server = Fastify({ logger: { level: env.LOG_LEVEL } });

  await server.register(cors);
  await server.register(adminRoutes);

  server.get('/api/health', async () => {
    return { ok: true, ts: Date.now() };
  });

  return server;
}
