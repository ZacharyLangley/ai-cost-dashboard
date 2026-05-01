import type { FastifyPluginAsync } from 'fastify';
import type { DrizzleDb } from '../../db/client.js';
import { monthParam } from '../schemas/common.js';
import { ValidationError } from '../../lib/errors.js';
import {
  githubModels,
  acceptanceVsCost,
  m365AdoptionHeatmap,
  m365Breadth,
} from '../../services/queries/products.js';
import { z } from 'zod';

const monthQuerySchema = z.object({
  month: monthParam.optional(),
});

export const productRoutes: FastifyPluginAsync<{ db: DrizzleDb }> = async (server, opts) => {
  server.get('/api/products/github/models', async (req) => {
    const q = monthQuerySchema.safeParse(req.query);
    if (!q.success) throw new ValidationError('Invalid query', q.error.flatten().fieldErrors);
    return githubModels(q.data.month, opts.db);
  });

  server.get('/api/products/github/acceptance-vs-cost', async (req) => {
    const q = monthQuerySchema.safeParse(req.query);
    if (!q.success) throw new ValidationError('Invalid query', q.error.flatten().fieldErrors);
    return acceptanceVsCost(q.data.month, opts.db);
  });

  server.get('/api/products/m365/adoption-heatmap', async () => {
    return m365AdoptionHeatmap(opts.db);
  });

  server.get('/api/products/m365/breadth', async () => {
    return m365Breadth(opts.db);
  });
};
