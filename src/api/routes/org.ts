import type { FastifyPluginAsync } from 'fastify';
import type { DrizzleDb } from '../../db/client.js';
import { monthsParam, groupByParam, productParam } from '../schemas/common.js';
import { ValidationError } from '../../lib/errors.js';
import { getOrgSummary, getIdleSeats, getOrgTrend } from '../../services/queries/org.js';
import { z } from 'zod';

const idleQuerySchema = z.object({
  product: productParam.optional(),
});

const trendQuerySchema = z.object({
  months: monthsParam.default(12),
  groupBy: groupByParam,
});

export const orgRoutes: FastifyPluginAsync<{ db: DrizzleDb }> = async (server, opts) => {
  server.get('/api/org/summary', async () => {
    return getOrgSummary(opts.db);
  });

  server.get('/api/org/idle-seats', async (req) => {
    const q = idleQuerySchema.safeParse(req.query);
    if (!q.success) throw new ValidationError('Invalid query', q.error.flatten().fieldErrors);
    return getIdleSeats(q.data.product, opts.db);
  });

  server.get('/api/org/trend', async (req) => {
    const q = trendQuerySchema.safeParse(req.query);
    if (!q.success) throw new ValidationError('Invalid query', q.error.flatten().fieldErrors);
    return getOrgTrend(q.data.months, q.data.groupBy, opts.db);
  });
};
